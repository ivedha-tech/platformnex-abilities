import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, Ram, Snapshot } from '../types'

const PANE = 'agent-monitor'
const TITLE = 'Agents'
const POLL_MS = 3000
const HISTORY = 16
const BAR = 12
const BLOCKS = '▁▂▃▄▅▆▇█'
const ENDED = new Set(['completed', 'failed', 'killed'])

const EMPTY: Snapshot = {
  now: 0,
  agents: [],
  main: { window: 0 },
  ram: { samples: [] },
}

// Change the tag when Snapshot's fields change: it declines what an earlier
// version stored, which outlives a reload.
const snapshot = atom(
  { plugin: 'agent-monitor', key: 'snapshot' } as const,
  EMPTY,
  { shape: 'snapshot-1' },
)

// One listing for everything RAM needs: the host's pid, every process's
// parent and resident size, then the machine's totals (macOS or Linux).
const RAM_COMMAND =
  'echo "@pid $PPID"; ps -axo pid=,ppid=,rss=; echo "@mem"; ' +
  'sysctl -n hw.memsize 2>/dev/null; vm_stat 2>/dev/null; ' +
  'cat /proc/meminfo 2>/dev/null'

const parseRam = (stdout: string): Omit<Ram, 'samples'> => {
  const lines = stdout.split('\n')
  const split = lines.indexOf('@mem')
  const host = Number(/^@pid (\d+)/.exec(lines[0] ?? '')?.[1])
  const rss = new Map<number, number>()
  const children = new Map<number, number[]>()

  for (const line of lines.slice(1, split < 0 ? undefined : split)) {
    const [pid, ppid, kb] = line.trim().split(/\s+/).map(Number)
    if (pid === undefined || ppid === undefined || kb === undefined) continue
    if (Number.isNaN(pid + ppid + kb)) continue
    rss.set(pid, kb)
    children.set(ppid, [...(children.get(ppid) ?? []), pid])
  }

  let selfMb: number | undefined
  let treeMb: number | undefined
  if (rss.has(host)) {
    let kb = 0
    const queue = [host]
    const seen = new Set<number>()
    for (let pid = queue.pop(); pid !== undefined; pid = queue.pop()) {
      if (seen.has(pid)) continue
      seen.add(pid)
      kb += rss.get(pid) ?? 0
      queue.push(...(children.get(pid) ?? []))
    }
    selfMb = (rss.get(host) ?? 0) / 1024
    treeMb = kb / 1024
  }

  const mem = split < 0 ? [] : lines.slice(split + 1)
  const field = (name: string) => {
    const hit = mem.find(line => line.startsWith(name))
    const value = hit === undefined ? NaN : parseInt(hit.slice(name.length).replace(/[:\s]/g, ''), 10)

    return Number.isNaN(value) ? undefined : value
  }

  let usedMb: number | undefined
  let totalMb: number | undefined
  const linuxTotal = field('MemTotal')
  const linuxFree = field('MemAvailable')
  const macTotal = mem.find(line => /^\d+$/.test(line.trim()))
  const page = Number(/page size of (\d+) bytes/.exec(mem.join('\n'))?.[1])

  if (linuxTotal !== undefined && linuxFree !== undefined) {
    totalMb = linuxTotal / 1024
    usedMb = (linuxTotal - linuxFree) / 1024
  } else if (macTotal !== undefined && !Number.isNaN(page)) {
    const pages =
      (field('Pages active') ?? 0) +
      (field('Pages wired down') ?? 0) +
      (field('Pages occupied by compressor') ?? 0)
    totalMb = Number(macTotal.trim()) / 1048576
    usedMb = (pages * page) / 1048576
  }

  return { selfMb, treeMb, usedMb, totalMb }
}

const percentOf = (part: number | undefined, whole: number | undefined) =>
  part === undefined || whole === undefined || whole <= 0
    ? undefined
    : Math.min(100, Math.round((part / whole) * 100))

let isBusy = false

const refresh = async ($: EngineInterface) => {
  if (isBusy) return
  isBusy = true
  try {
    const [now, list, usage, ran] = await Promise.all([
      $.clock.now(),
      $.agent.list(),
      $.session.usage(),
      $.process.run(['sh', '-c', RAM_COMMAND], { timeoutMs: 5000 }).catch(() => undefined),
    ])
    const measured = ran === undefined || ran.exitCode !== 0 ? undefined : parseRam(ran.stdout)

    const next = await update($, snapshot, before => {
      const earlier = new Map(before.agents.map(one => [one.id, one]))
      const agents: AgentRow[] = list.map(agent => ({
        id: agent.id,
        type: agent.type,
        description: agent.description,
        label: agent.label,
        status: agent.status,
        startTime: agent.startTime,
        endedAt: ENDED.has(agent.status) ? (earlier.get(agent.id)?.endedAt ?? now) : undefined,
        tokenCount: agent.tokenCount,
        window: agent.contextWindowSize,
        samples: agent.tokenSamples.slice(-HISTORY),
      }))
      const used = percentOf(measured?.usedMb, measured?.totalMb)
      const ram: Ram =
        measured === undefined
          ? before.ram
          : {
              ...measured,
              samples: used === undefined ? before.ram.samples : [...before.ram.samples, used].slice(-HISTORY),
            }

      return {
        now,
        agents,
        main: { tokens: usage.context.tokens, window: usage.context.window },
        ram,
      }
    })

    const running = next.agents.filter(one => !ENDED.has(one.status)).length
    const used = percentOf(next.ram.usedMb, next.ram.totalMb)
    const parts = [
      running > 0 ? `${running} agent${running === 1 ? '' : 's'} running` : undefined,
      used !== undefined && (running > 0 || used >= 85) ? `RAM ${used}%` : undefined,
    ].filter(part => part !== undefined)
    $.ui.status(parts.length === 0 ? undefined : parts.join(' · '))
  } finally {
    isBusy = false
  }
}

const tone = (percent: number) => (percent >= 85 ? 'error' : percent >= 60 ? 'warning' : 'success')

const bar = (percent: number) => {
  const full = Math.round((percent / 100) * BAR)

  return '█'.repeat(full) + '░'.repeat(BAR - full)
}

const spark = (samples: number[], top?: number) => {
  const max = Math.max(1, top ?? Math.max(...samples))

  return samples.map(value => BLOCKS[Math.min(7, Math.max(0, Math.floor((value / max) * 8)))]).join('')
}

const tokens = (count: number) =>
  count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count >= 1000 ? `${Math.round(count / 1000)}k` : `${count}`

const elapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const two = (n: number) => String(n).padStart(2, '0')

  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h${two(minutes % 60)}m`
    : `${minutes}m${two(seconds % 60)}`
}

const gb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`)

const fit = (text: string, width: number) =>
  text.length <= width ? text.padEnd(width) : `${text.slice(0, Math.max(0, width - 1))}…`

const glyph = (status: string) =>
  status === 'completed' ? '✓' : status === 'failed' || status === 'killed' ? '✗' : status === 'running' ? '●' : '○'

const glyphTone = (status: string) =>
  status === 'completed' ? 'success' : status === 'failed' || status === 'killed' ? 'error' : status === 'running' ? 'claude' : 'inactive'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-monitor',
      description: 'Show agent progress, context use and RAM in a pane',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    void refresh($).catch(() => undefined)
    $.clock.every(POLL_MS, () => void refresh($).catch(() => undefined))

    return next(e)
  })

  on('command.run', { command: 'agent-monitor' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Agent monitor pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const columns = Math.max(24, e.props.bodyColumns ?? 40)
    const order = (one: AgentRow) => (ENDED.has(one.status) ? 1 : 0)
    const agents = [...snap.agents].sort((a, b) => order(a) - order(b) || b.startTime - a.startTime)
    const shown = agents.slice(0, 12)
    const count = (test: (status: string) => boolean) => agents.filter(one => test(one.status)).length
    const mainPercent = percentOf(snap.main.tokens, snap.main.window)
    const ramPercent = percentOf(snap.ram.usedMb, snap.ram.totalMb)

    const meter = (percent: number | undefined, used: number, of: number | undefined) =>
      percent === undefined ? (
        <Text dimColor>{tokens(used)} tokens</Text>
      ) : (
        <Box flexDirection="row">
          <Text color={tone(percent)}>{bar(percent)}</Text>
          <Text>
            {' '}
            {String(percent).padStart(3)}% {tokens(used)}/{tokens(of ?? 0)}
          </Text>
        </Box>
      )

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {count(s => !ENDED.has(s))} running · {count(s => s === 'completed')} done ·{' '}
          {count(s => s === 'failed' || s === 'killed')} failed
        </Text>
        <Text> </Text>
        {agents.length === 0 && <Text dimColor>No agents yet. They appear here as they start.</Text>}
        {shown.map(one => {
          const time = elapsed((one.endedAt ?? snap.now) - one.startTime)
          const percent = percentOf(one.tokenCount, one.window)
          const activity = (one.label.split('\n').find(line => line.trim() !== '') ?? '').trim()
          const trend = spark(one.samples)
          const hasActivity = !ENDED.has(one.status) && activity !== '' && activity !== one.description

          return (
            <Box flexDirection="column">
              <Box flexDirection="row">
                <Text color={glyphTone(one.status)}>{glyph(one.status)} </Text>
                <Text bold>{fit(`${one.type}  ${one.description}`, columns - 3 - time.length)}</Text>
                <Text dimColor> {time}</Text>
              </Box>
              <Box flexDirection="row">
                <Text dimColor>{'  ctx '}</Text>
                {meter(percent, one.tokenCount, one.window)}
              </Box>
              {(trend !== '' || hasActivity) && (
                <Text dimColor>
                  {fit(`  ${trend}${hasActivity ? `  ${activity}` : ''}`, columns)}
                </Text>
              )}
              <Text> </Text>
            </Box>
          )
        })}
        {agents.length > shown.length && <Text dimColor>+{agents.length - shown.length} more</Text>}
        <Box flexDirection="row">
          <Text dimColor>{'main ctx '}</Text>
          {meter(mainPercent, snap.main.tokens ?? 0, snap.main.window)}
        </Box>
        {snap.ram.treeMb !== undefined && (
          <Text>
            RAM  claude {gb(snap.ram.selfMb ?? 0)} (with children {gb(snap.ram.treeMb)})
          </Text>
        )}
        {ramPercent !== undefined && (
          <Box flexDirection="row">
            <Text>
              {snap.ram.treeMb === undefined ? 'RAM  ' : '     '}system {((snap.ram.usedMb ?? 0) / 1024).toFixed(1)} /{' '}
              {Math.round((snap.ram.totalMb ?? 0) / 1024)} GB{' '}
            </Text>
            <Text color={tone(ramPercent)}>
              {ramPercent}% {spark(snap.ram.samples, 100)}
            </Text>
          </Box>
        )}
        {ramPercent === undefined && snap.ram.treeMb === undefined && <Text dimColor>RAM  not measured yet</Text>}
      </Box>
    )
  })
}
