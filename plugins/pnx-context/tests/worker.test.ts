import { expect, test } from 'claude-code/testing'

import { ALREADY_RUNNING_EXIT, MIN_PNX, WANT_PNX, catalogUrlOf, devCycleSteps, endedNote, isAtLeast, isTakingJobs, lineNote, parseDeviceId, parseFind, parseNeeds, sessionEndAction, type Needs } from '../hooks/worker'

test('finds pnx from what the node lookup printed, and needs a new enough one', () => {
  expect(parseFind('{"cli":"C:\\\\npm\\\\node_modules\\\\@platformnex\\\\pnx\\\\dist\\\\cli.js","version":"0.1.18"}')).toEqual({ cli: 'C:\\npm\\node_modules\\@platformnex\\pnx\\dist\\cli.js', version: '0.1.18' })
  expect(parseFind('{"cli":"","version":""}')).toEqual({ cli: undefined, version: undefined })
  expect(parseFind('not json')).toEqual({})
  expect(isAtLeast(MIN_PNX)).toBe(true)
  expect(isAtLeast('0.1.17')).toBe(false)
  expect(isAtLeast('0.2.0')).toBe(true)
  expect(isAtLeast('1.0.0-beta')).toBe(true)
  expect(isAtLeast(undefined)).toBe(false)
  expect(isAtLeast('latest')).toBe(false)
})

test('talks to catalog-gateway under the portal', () => {
  expect(catalogUrlOf('https://agentic-platformnex-portal.dit1.ivedha.dev')).toBe('https://agentic-platformnex-portal.dit1.ivedha.dev/api/catalog')
})

test('reads pnx output: the last line, without timestamp or prefix, and when it takes jobs', () => {
  expect(lineNote('2026-11-18T09:30:01.123Z job abc (codegen.generate-and-pr) started\n')).toBe('job abc (codegen.generate-and-pr) started')
  expect(lineNote('pnx: claude is not signed in. Run `claude`, type /login, then try again.')).toBe('claude is not signed in. Run `claude`, type /login, then try again.')
  expect(lineNote('\n  \n')).toBeUndefined()
  expect(lineNote('x'.repeat(300))?.length).toBe(140)
  expect(isTakingJobs('Taking PlatformNEX jobs as SL-L176 (claude 2.1.327). Ctrl-C to stop.\n')).toBe(true)
  expect(isTakingJobs('Linked SL-L176.')).toBe(false)
})

test('says why it stopped, for the debug log: another window has it, or the last error', () => {
  expect(endedNote(ALREADY_RUNNING_EXIT, 'pnx claude run is already running on this machine (pid 7).')).toBe('another Claude Code window on this machine runs it')
  expect(endedNote(1, 'the API key was not accepted')).toBe('stopped (the API key was not accepted); trying again in a minute')
  expect(endedNote(null, undefined)).toMatch(/exit signal/)
})

const ALL_SET: Needs = { node: '22.3.0', git: true, gh: true, ghSignedIn: true, fastDevRan: true, problem: '', released: '' }
const PNX = { cli: '/npm/@platformnex/pnx/dist/cli.js', version: MIN_PNX }

test('reads what the needs lookup printed; nothing printed means no Node', () => {
  expect(parseNeeds('{"node":"22.3.0","git":true,"gh":true,"ghSignedIn":false,"fastDevRan":true,"problem":"auth"}')).toEqual({ ...ALL_SET, ghSignedIn: false, problem: 'auth' })
  expect(parseNeeds(undefined)).toBeUndefined()
  expect(parseNeeds('{}')).toBeUndefined()
})

test('the check says one line when the worker is online or off', () => {
  expect(devCycleSteps({ isOff: false, status: 'online', pnx: {} })).toEqual([{ label: 'Dev cycles', ok: true, detail: 'your Claude Code is online' }])
  expect(devCycleSteps({ isOff: true, status: 'offline', pnx: {} })[0]?.ok).toBeUndefined()
})

test('when offline, the check names each missing thing with its fix', () => {
  expect(devCycleSteps({ isOff: false, status: 'offline', pnx: PNX })[0]?.fix).toMatch(/Node.js 20/)
  const fixOf = (needs: Partial<Needs>, pnx: { cli?: string; version?: string } = PNX) =>
    devCycleSteps({ isOff: false, status: 'offline', needs: { ...ALL_SET, ...needs }, pnx }).filter(s => s.ok === false).map(s => s.fix)
  expect(fixOf({})).toEqual([])
  expect(fixOf({ node: '18.19.0' })[0]).toMatch(/Node.js 20/)
  expect(fixOf({ fastDevRan: false }, {})[0]).toMatch(/pnx-fast-dev plugin/)
  expect(fixOf({ problem: 'auth' }, {})[0]).toMatch(/gcloud auth login, then gcloud auth application-default login/)
  // No access is first a sign-in to check (often the wrong account), and only then an admin.
  expect(fixOf({ problem: 'access' }, {})[0]).toMatch(/work Google account.*admin/)
  expect(fixOf({ problem: 'network' }, {})[0]).toMatch(/internet or VPN/)
  expect(fixOf({ problem: 'install' }, {})[0]).toMatch(/didn't install.*install\.log/)
  // pnx-fast-dev updates at the next start (the wanted file lifts its daily wait): no command that a stale token refuses.
  expect(fixOf({}, { cli: PNX.cli, version: '0.1.17' })[0]).toBe('it updates by itself: restart Claude Code')
  // The registry has nothing new enough: no install helps, so it says so instead of "update".
  expect(fixOf({ released: '0.1.17' }, { cli: PNX.cli, version: '0.1.17' })[0]).toBe(`pnx ${MIN_PNX} isn't released yet; it installs by itself once it is`)
  expect(fixOf({ released: '0.1.17', problem: 'auth' }, {})[0]).toMatch(/isn't released yet/)
  expect(fixOf({ released: MIN_PNX }, { cli: PNX.cli, version: '0.1.17' })[0]).toBe('it updates by itself: restart Claude Code')
  expect(fixOf({ git: false })[0]).toMatch(/install git/)
  expect(fixOf({ gh: false, ghSignedIn: false })[0]).toMatch(/GitHub CLI/)
  expect(fixOf({ ghSignedIn: false })[0]).toBe('run: gh auth login')
})

test('"last try" shows why the worker stopped, unless Node.js or pnx failing already says it', () => {
  const lastTry = (needs: Partial<Needs>, pnx: { cli?: string; version?: string } = PNX) =>
    devCycleSteps({ isOff: false, status: 'offline', note: 'the API key was not accepted', needs: { ...ALL_SET, ...needs }, pnx }).find(s => s.label === 'last try')
  expect(lastTry({})).toEqual({ label: 'last try', ok: undefined, detail: 'the API key was not accepted' })
  // git and gh never stop the worker: the real reason stays.
  expect(lastTry({ ghSignedIn: false })?.detail).toBe('the API key was not accepted')
  expect(lastTry({ gh: false, git: false })?.detail).toBe('the API key was not accepted')
  // Node.js or pnx failing is the reason, said above; an older note would only contradict it.
  expect(lastTry({}, { cli: PNX.cli, version: '0.1.17' })).toBeUndefined()
  expect(lastTry({}, {})).toBeUndefined()
  expect(lastTry({ node: '18.19.0' })).toBeUndefined()
})

test('asks pnx-fast-dev for the pnx dev cycles need, in pnx\'s own folder', () => {
  expect(WANT_PNX).toContain(`'${MIN_PNX}'`)
  expect(WANT_PNX).toContain('.ensure-wanted')
  expect(WANT_PNX).toContain('PNX_CONFIG_DIR')
})

test('takes the device id pnx saved, only for this PlatformNEX', () => {
  const saved = JSON.stringify({ deviceId: 'd-1', machineName: 'SL-L176', catalogUrl: 'https://p.example/api/catalog' })
  expect(parseDeviceId(saved, 'https://p.example/api/catalog')).toBe('d-1')
  expect(parseDeviceId(saved, 'https://other.example/api/catalog')).toBeUndefined()
  expect(parseDeviceId('', 'https://p.example/api/catalog')).toBeUndefined()
})

test('keeps the worker through /clear and /resume, stops it when Claude Code exits, and pauses it otherwise', () => {
  expect(sessionEndAction('clear')).toBe('keep')
  expect(sessionEndAction('resume')).toBe('keep')
  expect(sessionEndAction('prompt_input_exit')).toBe('leave')
  expect(sessionEndAction('other')).toBe('leave')
  expect(sessionEndAction('logout')).toBe('pause')
  expect(sessionEndAction('a-reason-added-later')).toBe('pause')
})
