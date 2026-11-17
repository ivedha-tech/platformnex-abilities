import { expect, test } from 'claude-code/testing'

import type { Data, Match, Ui } from '../types'
import { bareName, handoffUrl, isPnxTool, parseAsk, pickActiveMatch, pushAsk, scrub, textOf } from '../hooks/skills'

const NOW = Date.parse('2026-11-17T09:30:00Z')
const PLAN = JSON.stringify({
  intent: 'Raise the upload limit',
  systemRef: 'system:default/speakupnex',
  riskLevel: 'medium',
  planSteps: [
    { label: 'Create a ticket in ServiceNEX', detail: 'Raise the request.', state: 'pending' },
    { label: 'Draft the change', detail: 'Why, plan, back-out.', state: 'pending' },
  ],
  evidence: [{ k: 'environments', v: 'dit1 · prod' }],
  executed: false,
  note: 'Plan only. Nothing has been created.',
})

test('a plan answer becomes ordered steps, risk and evidence, with nothing executed', async () => {
  const ask = parseAsk('mcp__pnx-context__plan_propose', { systemRef: 'system:default/speakupnex', summary: 'Raise the upload limit' }, PLAN, false, NOW)

  expect(ask?.kind).toBe('plan')
  expect(ask?.title).toBe('CHANGE PLAN')
  expect(ask?.system).toBe('default/speakupnex')
  expect(ask?.asked).toBe('Raise the upload limit')
  expect(ask?.steps?.map(s => s.label)).toEqual(['Create a ticket in ServiceNEX', 'Draft the change'])
  expect(ask?.risk).toBe('medium')
  expect(ask?.executed).toBe(false)
  expect(ask?.evidence).toEqual([{ k: 'environments', v: 'dit1 · prod' }])
})

test('a Lens team answer keeps its facts and block titles, not chart data', async () => {
  const text = JSON.stringify({ callId: 'a-1', facts: ['Bob released twice', 'Sam merged 3 PRs'], blocks: [{ id: 'a-1.0', title: 'KPIs', kind: 'kpis' }] })
  const ask = parseAsk('mcp__platformnex__lens_team_activity', { systemRef: 'system:default/shop' }, text, false, NOW)

  expect(ask?.kind).toBe('team')
  expect(ask?.title).toBe('TEAM')
  expect(ask?.facts).toEqual(['Bob released twice', 'Sam merged 3 PRs'])
  expect(ask?.blocks).toEqual([{ title: 'KPIs', kind: 'kpis' }])
})

test('a key, bearer or token in an answer is never kept', async () => {
  const text = JSON.stringify({ facts: ['key pnx_abcd1234_secretsecret leaked', 'Authorization: Bearer abcdefghijklmnop', 'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig'], blocks: [] })
  const ask = parseAsk('mcp__platformnex__lens_cost', {}, text, false, NOW)
  const all = JSON.stringify(ask)

  expect(all).not.toMatch(/pnx_abcd1234/)
  expect(all).not.toMatch(/abcdefghijklmnop/)
  expect(all).not.toMatch(/eyJhbGci/)
  expect(scrub('pnx_abcd1234_xxxxxx', 40)).toBe('[hidden]')
})

test('an error, a non-JSON answer and a refusal never throw and say something plain', async () => {
  expect(parseAsk('mcp__platformnex__lens_cost', {}, 'MCP error -32602: Tool plan_propose not found', true, NOW)?.note).toBe('MCP error -32602: Tool plan_propose not found')
  expect(parseAsk('mcp__platformnex__lens_cost', {}, '', true, NOW)?.note).toBe('The tool reported an error.')
  expect(parseAsk('mcp__platformnex__lens_cost', {}, 'failed with pnx_abcd1234_secretsecret', true, NOW)?.note).not.toMatch(/pnx_abcd1234/)
  expect(parseAsk('mcp__platformnex__lens_cost', {}, 'plain words', false, NOW)?.facts).toEqual(['plain words'])
  expect(parseAsk('mcp__platformnex__lens_cost', {}, JSON.stringify({ error: 'Lens is turned off.' }), false, NOW)?.note).toBe('Lens is turned off.')
  expect(parseAsk('mcp__platformnex__lens_cost', null, undefined, false, NOW)?.note).toBeDefined()
  expect(parseAsk('mcp__platformnex__lens_cost', {}, JSON.stringify({ unrelated: true }), false, NOW)?.note).toMatch(/Nothing to show/)
})

test('a very large answer is not parsed', async () => {
  const ask = parseAsk('mcp__platformnex__lens_cost', {}, 'x'.repeat(300_000), false, NOW)
  expect(ask?.facts).toEqual([])
  expect(ask?.note).toBeDefined()
})

test('only the newest five are kept, and the same question replaces its older answer', async () => {
  const make = (n: number, asked: string) => parseAsk('mcp__pnx-context__plan_propose', { systemRef: 'system:default/a', summary: asked }, PLAN, false, NOW + n)!
  let items = [] as ReturnType<typeof make>[]
  for (let i = 0; i < 7; i += 1) items = pushAsk(items, make(i, `change ${i}`))
  expect(items).toHaveLength(5)
  expect(items[0]?.asked).toBe('change 6')

  items = pushAsk(items, make(99, 'change 4'))
  expect(items.filter(a => a.asked === 'change 4')).toHaveLength(1)
  expect(items[0]?.asked).toBe('change 4')
})

test('tool names and results are read the way the engine spells them', async () => {
  expect(bareName('mcp__platformnex__lens_team_activity')).toBe('lens_team_activity')
  expect(bareName('mcp__pnx-context__plan_propose')).toBe('plan_propose')
  expect(isPnxTool('mcp__platformnex__lens_cost')).toBe(true)
  expect(isPnxTool('mcp__pnx-context__plan_propose')).toBe(true)
  expect(isPnxTool('mcp__github__issue')).toBe(false)
  expect(isPnxTool(undefined)).toBe(false)
  expect(textOf('{"a":1}')).toBe('{"a":1}')
  expect(textOf({ content: [{ type: 'text', text: 'hi ' }, { type: 'image' }, { type: 'text', text: 'there' }] })).toBe('hi there')
  expect(textOf({ content: [] })).toBeUndefined()
})

const BASE = 'https://portal.example.test'
const COMPONENT = { ref: 'component:default/speakupnex-api', systemRefs: ['system:default/speakupnex'] }

test('the Agent mode link names the System page, the sentence and the component, and sends nothing itself', async () => {
  const url = new URL(handoffUrl(BASE, 'default/speakupnex', 'Raise the upload limit', COMPONENT) ?? '')

  expect(url.origin).toBe(BASE)
  expect(url.pathname).toBe('/s/default/speakupnex/components')
  expect(url.searchParams.get('assistant')).toBe('agent')
  expect(url.searchParams.get('text')).toBe('Plan: Raise the upload limit')
  expect(url.searchParams.get('entity')).toBe('component:default/speakupnex-api')
})

test('the link leaves the component out when it is in another System or does not look like a ref', async () => {
  const other = new URL(handoffUrl(BASE, 'default/speakupnex', 'x change', { ref: 'component:default/other-api', systemRefs: ['system:default/forcenex'] }) ?? '')
  expect(other.searchParams.has('entity')).toBe(false)

  const odd = new URL(handoffUrl(BASE, 'default/speakupnex', 'x change', { ref: 'https://evil.example/x', systemRefs: ['system:default/speakupnex'] }) ?? '')
  expect(odd.searchParams.has('entity')).toBe(false)

  expect(new URL(handoffUrl(BASE, 'default/speakupnex', 'x change', undefined) ?? '').searchParams.has('entity')).toBe(false)
})

test('no link for a System that is not <ns>/<name>, and a key in the sentence is not put in the link', async () => {
  for (const bad of [undefined, '', 'speakupnex', 'a/b/c', 'default/../x', 'default/speak upnex', 'default/<x>']) expect(handoffUrl(BASE, bad, 'x change', COMPONENT)).toBeUndefined()
  expect(handoffUrl(BASE, 'default/speakupnex', 'use pnx_abcd1234_secretsecret here', COMPONENT)).not.toMatch(/pnx_abcd1234/)
})

const match = (ref: string, system: string): Match => ({ entityRef: ref, name: ref.split('/')[1] ?? ref, systemRefs: [system], environments: [] })
const repos = (): Data => ({
  at: 1,
  status: 'ok',
  repos: [
    { root: '/w/a', name: 'a', lookup: 'found', matches: [match('component:default/a-api', 'system:default/a'), match('component:default/a-web', 'system:default/a')] },
    { root: '/w/b', name: 'b', lookup: 'found', matches: [match('component:default/b-api', 'system:default/b')] },
    { root: '/w/c', name: 'c', lookup: 'none', matches: [] },
  ],
})

test('the component the pane shows is the chosen repository, else where the session is, else the first match', async () => {
  const d = repos()
  const ui: Ui = {}

  expect(pickActiveMatch(d, ui, '/w/b/src')?.entityRef).toBe('component:default/b-api')
  expect(pickActiveMatch(d, ui, '/elsewhere')?.entityRef).toBe('component:default/a-api')
  expect(pickActiveMatch(d, { chosenRoot: '/w/b' }, '/w/a')?.entityRef).toBe('component:default/b-api')
  expect(pickActiveMatch(d, { activeEntity: 'component:default/a-web' }, '/w/a')?.entityRef).toBe('component:default/a-web')
  expect(pickActiveMatch({ at: 1, status: 'ok', repos: [] }, ui, '/w/a')).toBeUndefined()
})
