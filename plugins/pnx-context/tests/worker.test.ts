import { expect, test } from 'claude-code/testing'

import { ALREADY_RUNNING_EXIT, MIN_PNX, catalogUrlOf, devCycleSteps, endedNote, isAtLeast, isTakingJobs, lineNote, parseDeviceId, parseFind, parseNeeds, sessionEndAction, type Needs } from '../hooks/worker'

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

const ALL_SET: Needs = { node: '22.3.0', git: true, gh: true, ghSignedIn: true, fastDevRan: true, problem: '' }
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
  expect(fixOf({ fastDevRan: false }, {})[0]).toMatch(/pnx-fast-dev Ability/)
  expect(fixOf({ problem: 'auth' }, {})[0]).toMatch(/gcloud auth application-default login/)
  expect(fixOf({ problem: 'access' }, {})[0]).toMatch(/admin/)
  expect(fixOf({}, { cli: PNX.cli, version: '0.1.17' })[0]).toContain('npm i -g @platformnex/pnx')
  expect(fixOf({ git: false })[0]).toMatch(/install git/)
  expect(fixOf({ gh: false, ghSignedIn: false })[0]).toMatch(/GitHub CLI/)
  expect(fixOf({ ghSignedIn: false })[0]).toBe('run: gh auth login')
  expect(devCycleSteps({ isOff: false, status: 'offline', note: 'the API key was not accepted', needs: ALL_SET, pnx: PNX }).pop()).toEqual({ label: 'last try', ok: undefined, detail: 'the API key was not accepted' })
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
