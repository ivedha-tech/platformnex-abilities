import { expect, test } from 'claude-code/testing'

import { bareName, isPnxTool, parseAsk, pushAsk, scrub, textOf } from '../hooks/skills'

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
  expect(parseAsk('mcp__platformnex__lens_cost', {}, 'boom', true, NOW)?.note).toMatch(/error/)
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
