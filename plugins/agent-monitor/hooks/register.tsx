import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, Ram, RosterEntry, Snapshot } from '../types'

const PANE = 'agent-monitor'
const TITLE = 'Agents · LIVE'
const RECENT_MS = 10_000
const ROSTER_EVERY = 20
const IDLE_SHOWN = 4
const IDLE_SHOWN_ACTIVE = 2
const POLL_MS = 3000
const HISTORY = 16
const BAR = 12
const BLOCKS = '▁▂▃▄▅▆▇█'
const ENDED = new Set(['completed', 'failed', 'killed'])

const EMPTY: Snapshot = {
  now: 0,
  agents: [],
  roster: [],
  main: { window: 0 },
  ram: { samples: [] },
}

// Used when the installed marketplace cannot be read: the agents the
// abilities repo defines. The scan below is the source; this only backs it.
const FALLBACK_TEAMS: Record<string, string[]> = {
  'ccw-workflow': [
    'action-planning-agent', 'cli-discuss-agent', 'cli-execution-agent', 'cli-explore-agent',
    'cli-lite-planning-agent', 'cli-planning-agent', 'cli-roadmap-plan-agent', 'code-developer',
    'conceptual-planning-agent', 'context-search-agent', 'debug-explore-agent', 'doc-generator',
    'issue-plan-agent', 'issue-queue-agent', 'memory-bridge', 'tdd-developer', 'team-supervisor',
    'team-worker', 'test-action-planning-agent', 'test-context-search-agent', 'test-fix-agent',
    'ui-design-agent', 'universal-executor', 'workflow-research-agent',
  ],
  'harness-core': ['code-reviewer', 'security-auditor', 'test-engineer', 'web-performance-auditor'],
  'pnx-harness': ['compliance-reviewer'],
}

const FALLBACK_ROSTER: RosterEntry[] = Object.entries(FALLBACK_TEAMS).flatMap(([team, names]) =>
  names.map(name => ({ team, name })),
)

// Change the tag when Snapshot's fields change: it declines what an earlier
// version stored, which outlives a reload.
const snapshot = atom(
  { plugin: 'agent-monitor', key: 'snapshot' } as const,
  EMPTY,
  { shape: 'snapshot-2' },
)

// Agent files of the installed marketplace, one path a line:
// .../cache/<marketplace>/<plugin>/<version>/agents/<name>.md
const ROSTER_COMMAND =
  'for f in "$HOME"/.claude/plugins/cache/platformnex-abilities/*/*/agents/*.md; do [ -f "$f" ] && echo "$f"; done; true'

const parseRoster = (stdout: string): RosterEntry[] => {
  const seen = new Set<string>()
  const roster: RosterEntry[] = []

  for (const line of stdout.split('\n')) {
    const parts = line.trim().split('/')
    const at = parts.lastIndexOf('agents')
    const team = parts[at - 2]
    const name = parts[at + 1]?.replace(/\.md$/, '')
    if (at < 2 || team === undefined || name === undefined || name === '') continue
    if (seen.has(`${team}:${name}`)) continue
    seen.add(`${team}:${name}`)
    roster.push({ team, name })
  }

  return roster
}

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
let ticks = 0

const refresh = async ($: EngineInterface) => {
  if (isBusy) return
  isBusy = true
  try {
    const wantsRoster = ticks++ % ROSTER_EVERY === 0
    const [now, list, usage, ran, scan] = await Promise.all([
      $.clock.now(),
      $.agent.list(),
      $.session.usage(),
      $.process.run(['sh', '-c', RAM_COMMAND], { timeoutMs: 5000 }).catch(() => undefined),
      wantsRoster
        ? $.process.run(['sh', '-c', ROSTER_COMMAND], { timeoutMs: 5000 }).catch(() => undefined)
        : undefined,
    ])
    const measured = ran === undefined || ran.exitCode !== 0 ? undefined : parseRam(ran.stdout)
    const scanned = scan === undefined || scan.exitCode !== 0 ? undefined : parseRoster(scan.stdout)
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

      const roster =
        scanned !== undefined && scanned.length > 0
          ? scanned
          : before.roster.length > 0
            ? before.roster
            : FALLBACK_ROSTER

      return {
        now,
        agents,
        roster,
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
  status === 'completed' ? 'success' : status === 'failed' || status === 'killed' ? 'error' : status === 'running' ? 'success' : 'inactive'

type Line = { name: string; state: 'active' | 'ok' | 'failed' | 'idle'; agent?: AgentRow }
type Team = { name: string; total: number; active: number; lines: Line[] }

// Active while running; for RECENT_MS after it ends, ok or failed; then nothing.
const stateOf = (agent: AgentRow, now: number): Line['state'] | undefined => {
  if (!ENDED.has(agent.status)) return 'active'
  if (now - (agent.endedAt ?? now) > RECENT_MS) return undefined

  return agent.status === 'completed' ? 'ok' : 'failed'
}

const isType = (agent: AgentRow, entry: RosterEntry) =>
  agent.type === `${entry.team}:${entry.name}` || agent.type === entry.name

// Every agent the marketplace defines, by plugin, with what is running now.
// Agents spawned from outside the roster (Explore, general-purpose) go under
// "built-in" while they run, so nothing the session started goes missing.
const buildTeams = (snap: Snapshot): Team[] => {
  const byTeam = new Map<string, RosterEntry[]>()
  for (const entry of snap.roster) byTeam.set(entry.team, [...(byTeam.get(entry.team) ?? []), entry])

  const claimed = new Set<string>()
  const live = (agent: AgentRow, name: string): Line | undefined => {
    const state = stateOf(agent, snap.now)

    return state === undefined ? undefined : { name, state, agent }
  }
  const teams: Team[] = []

  for (const [name, entries] of byTeam) {
    const lines: Line[] = []
    for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
      const mine = snap.agents.filter(agent => isType(agent, entry))
      mine.forEach(agent => claimed.add(agent.id))
      const shown = mine.map(agent => live(agent, entry.name)).filter(line => line !== undefined)
      const running = shown.filter(line => line.state === 'active')
      const latest = shown.filter(line => line.state !== 'active').sort(
        (a, b) => (b.agent?.endedAt ?? 0) - (a.agent?.endedAt ?? 0),
      )[0]

      if (running.length > 0) lines.push(...running)
      else if (latest !== undefined) lines.push(latest)
      else lines.push({ name: entry.name, state: 'idle' })
    }
    teams.push({
      name,
      total: entries.length,
      active: lines.filter(line => line.state === 'active').length,
      lines,
    })
  }

  const others = snap.agents
    .filter(agent => !claimed.has(agent.id))
    .map(agent => live(agent, agent.type))
    .filter(line => line !== undefined)
  if (others.length > 0) {
    teams.push({
      name: 'built-in',
      total: new Set(others.map(line => line.name)).size,
      active: others.filter(line => line.state === 'active').length,
      lines: others,
    })
  }

  const rank = (line: Line) => (line.state === 'idle' ? 1 : 0)
  for (const team of teams) team.lines.sort((a, b) => rank(a) - rank(b))

  return teams.sort((a, b) => Number(b.active > 0) - Number(a.active > 0) || a.name.localeCompare(b.name))
}

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
    const teams = buildTeams(snap)
    const activeCount = teams.reduce((sum, team) => sum + team.active, 0)
    const totalCount = teams.reduce((sum, team) => sum + team.total, 0)
    const count = (test: (status: string) => boolean) => snap.agents.filter(one => test(one.status)).length
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
        <Box flexDirection="row">
          {activeCount > 0 ? (
            <Text color="success" bold>
              {activeCount}/{totalCount} active
            </Text>
          ) : (
            <Text dimColor>
              {activeCount}/{totalCount} active
            </Text>
          )}
          <Text dimColor>
            {' '}
            · {count(s => s === 'completed')} done · {count(s => s === 'failed' || s === 'killed')} failed
          </Text>
        </Box>
        <Text> </Text>
        {teams.map(team => {
          const tally = `${team.active}/${team.total}`
          const hasAction = team.lines.some(line => line.state !== 'idle')
          const acted = team.lines.filter(line => line.state !== 'idle')
          const idle = team.lines.filter(line => line.state === 'idle')
          const cap = hasAction ? IDLE_SHOWN_ACTIVE : IDLE_SHOWN

          return (
            <Box flexDirection="column">
              <Box flexDirection="row">
                <Text bold>{fit(team.name, columns - tally.length - 1)}</Text>
                {team.active > 0 ? (
                  <Text color="success"> {tally}</Text>
                ) : (
                  <Text dimColor> {tally}</Text>
                )}
              </Box>
              {acted.map(line => {
                const one = line.agent
                if (one === undefined) return null
                const time = elapsed((one.endedAt ?? snap.now) - one.startTime)
                const label = fit(line.name, columns - 5 - time.length)

                if (line.state !== 'active') {
                  return (
                    <Box flexDirection="row">
                      <Text color={glyphTone(one.status)}>{'  '}{glyph(one.status)} </Text>
                      <Text color={glyphTone(one.status)}>{label}</Text>
                      <Text dimColor> {time}</Text>
                    </Box>
                  )
                }

                const percent = percentOf(one.tokenCount, one.window)
                const activity = (one.label.split('\n').find(row => row.trim() !== '') ?? '').trim()
                const trend = spark(one.samples)
                const hasActivity = activity !== '' && activity !== one.description

                return (
                  <Box flexDirection="column">
                    <Box flexDirection="row">
                      <Text color="success" bold>{'  '}● {label}</Text>
                      <Text dimColor> {time}</Text>
                    </Box>
                    <Box flexDirection="row">
                      <Text dimColor>{'      ctx '}</Text>
                      {meter(percent, one.tokenCount, one.window)}
                    </Box>
                    {(trend !== '' || hasActivity) && (
                      <Text dimColor>{fit(`      ${trend}${hasActivity ? `  ${activity}` : ''}`, columns)}</Text>
                    )}
                  </Box>
                )
              })}
              {idle.slice(0, cap).map(line => (
                <Text dimColor>{fit(`  ○ ${line.name}`, columns)}</Text>
              ))}
              {idle.length > cap && <Text dimColor>{`  … ${idle.length - cap} more`}</Text>}
              <Text> </Text>
            </Box>
          )
        })}
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

  // One row above the prompt while an agent is running; none otherwise.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    const names = [
      ...new Set(
        snap.agents
          .filter(one => !ENDED.has(one.status))
          .map(one => one.type.slice(one.type.lastIndexOf(':') + 1)),
      ),
    ]
    const running = snap.agents.filter(one => !ENDED.has(one.status)).length
    if (running === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const more = names.length > 3 ? ` +${names.length - 3}` : ''

    return (
      <Box flexDirection="row">
        <Text color="success">
          ● {running} agent{running === 1 ? '' : 's'} active{' '}
        </Text>
        <Text dimColor>
          {names.slice(0, 3).join(' · ')}
          {more}
        </Text>
      </Box>
    )
  })
}
