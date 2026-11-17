import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-monitor',
  component: 'Pane',
  requestId: 'agent-monitor',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const AGENT = {
  description: 'find auth callers',
  kind: 'local_agent',
  cwd: '/',
  hasRow: true,
} as const

// macOS output, made up: host pid 100 (1 GB) with one child (512 MB), on a
// 16 GB machine with 8 GB in use (page size 16384).
const PS = [
  '@pid 100',
  '    1     0   2048',
  '  100     1 1048576',
  '  101   100  524288',
  '  999     1  999999',
  '@mem',
  '17179869184',
  'Mach Virtual Memory Statistics: (page size of 16384 bytes)',
  'Pages free:                                 1000.',
  'Pages active:                             262144.',
  'Pages wired down:                         131072.',
  'Pages occupied by compressor:             131072.',
  '',
].join('\n')

test('the pane shows agents, context use and RAM, on every surface', async ($, on) => {
  const clock = mock.clock(on, { now: 200_000 })

  on('command.register', () => ({ value: { command: 'agent-monitor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.list', () => ({
    value: [
      {
        ...AGENT,
        id: 'a1',
        type: 'Explore',
        status: 'running',
        taskStatus: 'running',
        label: 'Reading gateway/auth.ts',
        startTime: 98_000,
        contextWindowSize: 200_000,
        tokenCount: 124_000,
        tokenSamples: [10_000, 60_000, 124_000],
      },
      {
        ...AGENT,
        id: 'a2',
        type: 'general-purpose',
        description: 'run unit tests',
        status: 'completed',
        taskStatus: 'completed',
        label: 'run unit tests',
        startTime: 50_000,
        tokenCount: 900,
        tokenSamples: [],
      },
    ],
  }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 54_000, window: 200_000, percent: 27 }, rateLimits: [] },
  }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: PS, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const has = async (text: RegExp) => (await ui.find({ type: 'Text', text }))?.text

    // 29 agents in the repo's three plugins, plus the 2 built-in types spawned.
    expect(await has(/active/)).toBe('1/31 active')
    expect(await has(/done/)).toMatch(/1 done · 0 failed/)
    expect(await has(/Explore/)).toMatch(/● Explore/)
    // 200 000 - 98 000 ms since it started.
    expect(await has(/1m42/)).toBe(' 1m42')
    expect(await has(/124k/)).toMatch(/62% 124k\/200k/)
    expect(await has(/Reading/)).toMatch(/▁▃▅ {2}Reading gateway\/auth\.ts/)
    // Finished a moment ago: shown as done, not as a row of its own forever.
    expect(await has(/general-purpose/)).toMatch(/general-purpose/)
    // Idle agents of the repo are listed, grouped by plugin.
    expect(await has(/○ code-reviewer/)).toMatch(/○ code-reviewer/)
    expect(await has(/^0\/4$/)).toMatch(/0\/4/)
    expect(await has(/27%/)).toMatch(/27% 54k\/200k/)
    expect(await has(/claude/)).toMatch(/claude 1\.0 GB \(with children 1\.5 GB\)/)
    expect(await has(/system/)).toMatch(/system 8\.0 \/ 16 GB/)
    await ui.unmount()
  }
})

test('with nothing running every agent is listed idle, and RAM is not measured', async ($, on) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /active/ }))?.text).toBe('0/29 active')
  expect((await ui.find({ type: 'Text', text: /code-developer/ }))?.text).toMatch(/○ code-developer/)
  expect((await ui.find({ type: 'Text', text: /RAM/ }))?.text).toBe('RAM  not measured yet')
  await ui.unmount()
})

test('a snapshot an earlier version stored is declined', async ($, on) => {
  on('state.get', () => ({ value: { value: { agents: 'old' }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /active/ }))?.text).toBe('0/29 active')
  await ui.unmount()
})
