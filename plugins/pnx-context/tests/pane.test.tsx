import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const BASE = 'https://portal.example.test'
const KEY = 'pnx_test_key_do_not_use'
const OPTIONS = { baseUrl: BASE, apiKey: KEY }

const PANE = {
  plugin: 'pnx-context',
  component: 'Pane',
  requestId: 'pnx-context',
  props: { title: 'PlatformNEX', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// A remote carrying a login: it must never leave the machine or reach the screen.
const SCAN = '/w/gateway\thttps://someone:s3cret-token@github.com/ivedha-tech/gateway.git\tfeat/x\tabc1234\n'

const ENV = (id: number, name: string, isProduction: boolean) => ({ id, name, isProduction })
const BY_REPO = {
  success: true,
  data: { items: [{ entityRef: 'component:default/gateway', kind: 'Component', namespace: 'default', name: 'gateway', title: 'Gateway', systemRefs: ['system:default/platform'], environments: [ENV(1, 'staging', false), ENV(2, 'production', true)] }] },
}
const HEALTH = {
  success: true,
  data: {
    current: { status: 'degraded', computed_at: '2026-11-17T09:00:00Z', components: [{ entityRef: 'component:default/gateway', status: 'at_risk' }], reasons: [{ message: 'Build failing on main' }] },
    history: ['healthy', 'healthy', 'at_risk'].map(status => ({ status })),
  },
}
const BATCH = {
  success: true,
  data: {
    entries: [
      { status: 'ok', payload: [{ id: '42', title: 'Add by-repo route', author: 'sam', status: 'open', url: 'https://github.com/ivedha-tech/gateway/pull/42', sourceBranch: 'feat/x', buildStatus: { state: 'success' } }] },
      { status: 'ok', payload: { pipelines: [{ status: 'SUCCESS', createTime: '1' }, { status: 'FAILURE', createTime: '2' }] } },
      null,
    ],
  },
}
const json = (body: unknown, status = 200) => ({ value: { status, ok: status >= 200 && status < 300, headers: {}, text: JSON.stringify(body) } })

type Sent = { url: string; method: string; headers: Record<string, string>; body?: string }

/** Stubs what sits beneath the mod: the host's network, shell and repo. Records every request. */
const stubWorld = (on: On, sent: Sent[], opts: { releases?: unknown; created?: unknown; byRepo?: unknown } = {}) => {
  on('command.register', () => ({ value: { command: 'pnx-context' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w/gateway' }))
  on('session.repo', () => ({ value: { root: '/w/gateway', remote: 'x', internal: false, name: null } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: SCAN, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('http.fetch', (_, e) => {
    sent.push({ url: e.url, method: e.init?.method ?? 'GET', headers: (e.init?.headers ?? {}) as Record<string, string>, body: typeof e.init?.body === 'string' ? e.init.body : undefined })
    if (e.url.endsWith('/auth/api-key-token')) return json({ success: true, data: { accessToken: 'short-lived', expiresIn: 900 } })
    if (e.url.includes('/entities/by-repo')) return json(opts.byRepo ?? BY_REPO)
    if (e.url.includes('/health')) return json(HEALTH)
    if (e.url.endsWith('/dashboard/batch')) return json(BATCH)
    if (e.url.includes('/releases') && (e.init?.method ?? 'GET') === 'POST') return json(opts.created ?? { success: true, data: { session: { id: 'rel-9' }, created: true } }, 201)
    if (e.url.includes('/releases')) return json(opts.releases ?? { success: true, data: { items: [] } })

    return json({ success: false }, 404)
  })
}

test('the pane shows the component, health, builds and pull requests, on every surface', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  stubWorld(on, sent)

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const has = async (text: RegExp) => (await ui.find({ type: 'Text', text }))?.text

    expect(await has(/^Gateway$/)).toBe('Gateway')
    expect(await has(/platform/)).toMatch(/default\/platform/)
    // The component's own status wins over the System's.
    expect(await has(/at risk/)).toMatch(/● at risk/)
    expect(await has(/Build failing/)).toMatch(/Build failing on main/)
    expect(await has(/^Pull requests/)).toBe('Pull requests (1)')
    expect(await has(/Add by-repo route/)).toMatch(/Add by-repo route/)
    expect(await has(/^Builds/)).toMatch(/^Builds/)
    expect(await has(/^Health 3d/)).toMatch(/^Health 3d/)
    await ui.unmount()
  }

  // The key goes to the configured host only, and only the first call carries it.
  expect(sent.length).toBeGreaterThan(0)
  expect(sent.every(r => r.url.startsWith(`${BASE}/`))).toBe(true)
  expect(sent.filter(r => JSON.stringify(r.headers).includes(KEY)).map(r => r.url)).toEqual([`${BASE}/api/catalog/auth/api-key-token`])
  // The login in the remote is stripped before anything is sent.
  expect(sent.some(r => r.url.includes('s3cret') || r.url.includes('someone'))).toBe(false)
  // Read-only: nothing but reads, plus the cached-snapshot POST.
  expect(sent.filter(r => r.method !== 'GET').map(r => r.url)).toEqual([`${BASE}/api/catalog/auth/api-key-token`, `${BASE}/api/aggregator/dashboard/batch`])
  expect(sent.some(r => r.url.includes('/refresh'))).toBe(false)
})

test('without a URL and key the pane says how to set up and nothing is sent', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const sent: Sent[] = []
  stubWorld(on, sent)

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /not set up yet/ }))?.text).toBe('PlatformNEX is not set up yet')
  expect(sent).toEqual([])
  await ui.unmount()
})

test('an http URL is refused: the key is never sent over it', { options: { baseUrl: 'http://portal.example.test', apiKey: KEY } }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const sent: Sent[] = []
  stubWorld(on, sent)

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()

  expect(sent).toEqual([])
})

test('Start a release opens a draft only: confirm first, never production, never deploy', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  stubWorld(on, sent)

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // Production has no button, only the reason.
  expect(await ui.find({ key: 'rel-component:default/gateway-2' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /production: in the portal/ }))?.text).toBeDefined()

  const before = sent.length
  await ui.press({ key: 'rel-component:default/gateway-1' })
  expect((await ui.find({ type: 'Text', text: /Open a draft release\?/ }))?.text).toBe('Open a draft release?')
  expect((await ui.find({ type: 'Text', text: /does not deploy/ }))?.text).toMatch(/It does not deploy/)
  expect((await ui.find({ type: 'Text', text: /branch feat\/x/ }))?.text).toMatch(/branch feat\/x \(local abc1234\)/)
  // Nothing was sent just by asking.
  expect(sent.slice(before).filter(r => r.method === 'POST' && r.url.endsWith('/releases'))).toEqual([])

  await ui.press({ key: 'confirm' })
  await clock.settle()

  const posts = sent.filter(r => r.method === 'POST' && r.url.endsWith('/api/catalog/releases'))
  expect(posts.length).toBe(1)
  expect(JSON.parse(posts[0]?.body ?? '{}')).toEqual({ entityRef: 'component:default/gateway', environmentId: 1, targetKind: 'branch', targetRef: 'feat/x' })
  expect(sent.some(r => /\/(deploy|rollback|complete|canary|config|proposals)\b/.test(r.url))).toBe(false)
  expect((await ui.find({ type: 'Text', text: /Draft release opened/ }))?.text).toMatch(/Review and deploy it in the portal/)
  await ui.unmount()
})

test('a repository with several components gets one set of cards for each, told apart by name', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  const second = { ...BY_REPO.data.items[0], entityRef: 'component:default/web', name: 'web', title: 'Web' }
  stubWorld(on, sent, { byRepo: { success: true, data: { items: [BY_REPO.data.items[0], second] } } })

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /^Gateway$/ }))?.text).toBe('Gateway')
  expect((await ui.find({ type: 'Text', text: /^Web$/ }))?.text).toBe('Web')
  expect((await ui.find({ type: 'Text', text: /^Pull requests \(1\) · gateway$/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^Pull requests \(1\) · web$/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^Releases · web$/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('an open release to the same environment is reused, not duplicated', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  stubWorld(on, sent, { releases: { success: true, data: { items: [{ id: 'rel-3', status: 'reviewing', environment_name: 'staging', target_ref: 'feat/x' }] } } })

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'rel-component:default/gateway-1' })
  await ui.press({ key: 'confirm' })
  await clock.settle()

  expect(sent.filter(r => r.method === 'POST' && r.url.endsWith('/api/catalog/releases'))).toEqual([])
  expect((await ui.find({ type: 'Text', text: /already open/ }))?.text).toMatch(/already open \(reviewing\)/)
  await ui.unmount()
})

test('a state an earlier version stored is declined', { options: OPTIONS }, async ($, on) => {
  on('state.get', () => ({ value: { value: { repos: 'old' }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /not set up yet|No git repository/ }))?.text).toBeDefined()
  await ui.unmount()
})
