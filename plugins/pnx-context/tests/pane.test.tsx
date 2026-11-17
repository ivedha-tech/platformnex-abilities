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
      { status: 'ok', payload: { pipelines: [{ status: 'SUCCESS', createTime: '1' }, { status: 'FAILURE', createTime: '2' }] } },
      null,
    ],
  },
}
const json = (body: unknown, status = 200) => ({ value: { status, ok: status >= 200 && status < 300, headers: {}, text: JSON.stringify(body) } })

type Sent = { url: string; method: string; headers: Record<string, string>; body?: string }

/** Stubs what sits beneath the mod: the host's network, shell and repo. Records every request. */
const stubWorld = (on: On, sent: Sent[], opts: { scan?: string; releases?: unknown; created?: unknown; byRepo?: unknown; byRepoStatus?: number; tokenStatus?: number } = {}) => {
  on('command.register', () => ({ value: { command: 'pnx-context' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w/gateway' }))
  on('session.repo', () => ({ value: { root: '/w/gateway', remote: 'x', internal: false, name: null } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: opts.scan ?? SCAN, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('http.fetch', (_, e) => {
    sent.push({ url: e.url, method: e.init?.method ?? 'GET', headers: (e.init?.headers ?? {}) as Record<string, string>, body: typeof e.init?.body === 'string' ? e.init.body : undefined })
    if (e.url.endsWith('/auth/api-key-token')) return opts.tokenStatus === undefined ? json({ success: true, data: { accessToken: 'short-lived', expiresIn: 900 } }) : json({ success: false, error: { message: 'This API key is invalid, expired or revoked.' } }, opts.tokenStatus)
    if (e.url.includes('/entities/by-repo')) return opts.byRepoStatus === undefined ? json(opts.byRepo ?? BY_REPO) : json({ success: false }, opts.byRepoStatus)
    if (e.url.includes('/health')) return json(HEALTH)
    if (e.url.endsWith('/dashboard/batch')) return json(BATCH)
    if (e.url.includes('/releases') && (e.init?.method ?? 'GET') === 'POST') return json(opts.created ?? { success: true, data: { session: { id: 'rel-9' }, created: true } }, 201)
    if (e.url.includes('/releases')) return json(opts.releases ?? { success: true, data: { items: [] } })

    return json({ success: false }, 404)
  })
}

test('the pane shows the component, health, builds and releases, and no pull requests, on every surface', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  stubWorld(on, sent)

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const has = async (text: RegExp) => (await ui.find({ type: 'Text', text }))?.text

    expect(await has(/^GATEWAY$/)).toBe('GATEWAY')
    expect(await has(/platform/)).toMatch(/default\/platform/)
    // The component's own status wins over the System's.
    expect(await has(/at risk/)).toMatch(/● at risk/)
    expect(await has(/Build failing/)).toMatch(/Build failing on main/)
    // Pull requests are not drawn, and not asked for.
    expect(await has(/PULL REQUESTS/)).toBeUndefined()
    expect(await has(/pull requests/)).toBeUndefined()
    expect(await has(/Add by-repo route/)).toBeUndefined()
    expect(await has(/^RELEASES$/)).toBe('RELEASES')
    expect(await has(/^builds/)).toMatch(/^builds ×2/)
    expect(await has(/^health 3d/)).toMatch(/^health 3d/)
    // The short notes beside the gauges.
    expect(await has(/passing/)).toBe('50% passing')
    expect(await has(/at risk$/)).toMatch(/1 day at risk|● at risk/)
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

  expect((await ui.find({ type: 'Text', text: /SET UP PLATFORMNEX/ }))?.text).toBe('SET UP PLATFORMNEX')
  // The default address is set; only the key is missing.
  expect((await ui.find({ type: 'Text', text: /of 2 set/ }))?.text).toBe('1 of 2 set')
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

test('a repository with several components gets a tab for each; the tab chosen decides what is shown', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  const second = { ...BY_REPO.data.items[0], entityRef: 'component:default/web', name: 'web', title: 'Web' }
  stubWorld(on, sent, { byRepo: { success: true, data: { items: [BY_REPO.data.items[0], second] } } })

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ key: 'tab-component:default/gateway' })).toBeDefined()
  expect(await ui.find({ key: 'tab-component:default/web' })).toBeDefined()
  // The first component is shown until another tab is chosen.
  expect((await ui.find({ type: 'Text', text: /^GATEWAY$/ }))?.text).toBe('GATEWAY')
  expect(await ui.find({ type: 'Text', text: /^WEB$/ })).toBeUndefined()

  await ui.press({ key: 'tab-component:default/web' })
  expect((await ui.find({ type: 'Text', text: /^WEB$/ }))?.text).toBe('WEB')
  expect(await ui.find({ type: 'Text', text: /^GATEWAY$/ })).toBeUndefined()
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

test('/pnx-context setup prints the commands to copy and never a key', { options: OPTIONS }, async ($, on) => {
  const sent: Sent[] = []
  stubWorld(on, sent)
  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })

  const { text = '' } = await $.command.run({ command: 'pnx-context', args: 'setup', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  expect(text).toMatch(/read -rs K/)
  expect(text).toMatch(/claude plugin configure pnx-context@platformnex-abilities --values-stdin/)
  expect(text).toMatch(/\/plugin configure pnx-context@platformnex-abilities/)
  expect(text).toContain(`${BASE}/account/api-keys`)
  expect(text).not.toContain(KEY)
})

test('/pnx-context check passes every step with a good key, and shows the address but never the key', { options: OPTIONS }, async ($, on) => {
  const sent: Sent[] = []
  stubWorld(on, sent)
  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  sent.length = 0

  const { text = '' } = await $.command.run({ command: 'pnx-context', args: 'check', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  expect(text).toMatch(/✓ URL set\s+https:\/\/portal\.example\.test/)
  expect(text).toMatch(/✓ API key set\s+\(hidden\)/)
  expect(text).toMatch(/✓ key accepted/)
  expect(text).toMatch(/✓ lookup route/)
  expect(text).toMatch(/Ready\./)
  expect(text).not.toContain(KEY)
  // It signs in afresh and asks the lookup route one question: nothing else.
  expect(sent.map(r => r.url)).toEqual([`${BASE}/api/catalog/auth/api-key-token`, expect.stringContaining('/entities/by-repo')])
})

test('/pnx-context check says when the server has no repo lookup yet', { options: OPTIONS }, async ($, on) => {
  const sent: Sent[] = []
  stubWorld(on, sent, { byRepoStatus: 404 })
  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })

  const { text = '' } = await $.command.run({ command: 'pnx-context', args: 'check', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  expect(text).toMatch(/✓ key accepted/)
  expect(text).toMatch(/✗ lookup route\s+this PlatformNEX does not have the repo lookup yet/)
  expect(text).toMatch(/ask the platform team to deploy the by-repo route/)
  expect(text).toMatch(/Not ready yet/)
})

test('/pnx-context check names a key that was not accepted and skips the rest', { options: OPTIONS }, async ($, on) => {
  const sent: Sent[] = []
  stubWorld(on, sent, { tokenStatus: 401 })
  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })

  const { text = '' } = await $.command.run({ command: 'pnx-context', args: 'check', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  expect(text).toMatch(/✗ key accepted\s+the API key was not accepted/)
  expect(text).toMatch(/create a new key in the portal/)
  expect(text).toMatch(/· lookup route\s+skipped/)
  expect(text).not.toContain(KEY)
})

test('/pnx-context check with no key sends nothing and says what is missing', { options: { baseUrl: BASE } }, async ($, on) => {
  const sent: Sent[] = []
  stubWorld(on, sent)
  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })

  const { text = '' } = await $.command.run({ command: 'pnx-context', args: 'check', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  expect(text).toMatch(/✗ API key set\s+not set/)
  expect(sent).toEqual([])
})

test('the pane says the server has no repo lookup yet, not just "not found"', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const sent: Sent[] = []
  stubWorld(on, sent, { byRepoStatus: 404 })

  await $.session.start({ cwd: '/w/gateway', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /does not have the repo lookup yet/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('a state an earlier version stored is declined', { options: OPTIONS }, async ($, on) => {
  on('state.get', () => ({ value: { value: { repos: 'old' }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /SET UP PLATFORMNEX|No git repository/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('a folder with many repositories lists them a page at a time, and a repository can be picked', { options: OPTIONS }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T09:30:00Z') })
  const sent: Sent[] = []
  const scan = Array.from({ length: 10 }, (_, i) => `/w/r${i}\thttps://github.com/ivedha-tech/r${i}.git\tmain\tabc123${i}\n`).join('')
  stubWorld(on, sent, { scan })
  on('session.cwd', () => ({ value: '/w/r0' }))

  await $.session.start({ cwd: '/w/r0', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /REPOSITORIES/ }))?.text).toMatch(/10/)
  // First page: eight rows, the one in view is not a button, the ninth repository is on the next page.
  expect(await ui.find({ key: 'pick-/w/r1' })).toBeDefined()
  expect(await ui.find({ key: 'pick-/w/r0' })).toBeUndefined()
  expect(await ui.find({ key: 'pick-/w/r8' })).toBeUndefined()

  await ui.press({ key: 'page-next' })
  expect(await ui.find({ key: 'pick-/w/r8' })).toBeDefined()
  expect(await ui.find({ key: 'pick-/w/r1' })).toBeUndefined()

  await ui.press({ key: 'pick-/w/r8' })
  await clock.settle()
  expect(await ui.find({ key: 'pick-/w/r8' })).toBeUndefined()
  expect(await ui.find({ key: 'pick-/w/r0' })).toBeDefined()
  await ui.unmount()
})
