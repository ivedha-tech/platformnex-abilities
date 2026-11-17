// What the pane keeps of a PlatformNEX tool's answer: a small, capped, scrubbed record. Pure, so it can be tested without the engine.
import { cap, rootContaining } from './lib'
import type { Ask, Data, Match, Ui } from '../types'

/** The tools the mod itself offers, and the server another config may call `platformnex`. */
export const OWN_PREFIX = 'mcp__pnx-context__'
export const isPnxTool = (tool: unknown): tool is string => typeof tool === 'string' && (tool.startsWith('mcp__platformnex__') || tool.startsWith(OWN_PREFIX))

/** The tool's own name without the server prefix: `plan_propose`, `lens_team_activity`, `pnx_plan_change`. */
export const bareName = (tool: string): string => tool.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '')

const MAX_FACTS = 12
const MAX_STEPS = 8
const MAX_EVIDENCE = 8
const MAX_BLOCKS = 8
const MAX_RAW = 200_000

// A key, a bearer or a JWT must never reach the screen or the stored state, whatever a server answers.
const SECRET = /pnx_[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]*)?/g
export const scrub = (value: unknown, max: number): string => cap(String(value ?? '').replace(SECRET, '[hidden]'), max)

const obj = (v: unknown): Record<string, unknown> | undefined => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** An MCP tool result's text: a string, or `{content:[{type:'text', text}]}`. */
export const textOf = (result: unknown): string | undefined => {
  if (typeof result === 'string') return result
  const content = arr(obj(result)?.['content'])
  const text = content.map(c => (obj(c)?.['type'] === 'text' && typeof obj(c)?.['text'] === 'string' ? (obj(c)?.['text'] as string) : '')).join('')

  return text === '' ? undefined : text
}

const titleOf = (name: string): string =>
  name === 'plan_propose' || name === 'pnx_plan_change'
    ? 'CHANGE PLAN'
    : name.startsWith('lens_team_')
      ? 'TEAM'
      : name.replace(/^lens_|^pnx_/, '').replace(/_/g, ' ').toUpperCase()

/** Turns one tool answer into an Ask, or undefined when there is nothing worth showing. Never throws. */
export const parseAsk = (tool: string, input: unknown, text: string | undefined, isError: boolean, now: number): Ask | undefined => {
  try {
    const name = bareName(tool)
    const args = obj(input)
    const system = typeof args?.['systemRef'] === 'string' ? scrub((args['systemRef'] as string).replace(/^system:/i, ''), 60) : undefined
    const asked = typeof args?.['summary'] === 'string' ? scrub(args['summary'], 120) : undefined
    const base = { id: `${now}-${name}`, tool: name, at: now, title: titleOf(name), system, asked }
    if (isError || text === undefined || text.length > MAX_RAW) return { ...base, kind: 'generic', facts: [], note: isError ? 'The tool reported an error.' : 'No answer to show.' }

    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return { ...base, kind: 'generic', facts: [scrub(text, 200)] }
    }
    const data = obj(body)
    if (data?.['error'] !== undefined && typeof data['error'] === 'string') return { ...base, kind: 'generic', facts: [], note: scrub(data['error'], 160) }

    const steps = arr(data?.['planSteps'])
    if (steps.length > 0) {
      return {
        ...base,
        kind: 'plan',
        facts: [],
        risk: typeof data?.['riskLevel'] === 'string' ? scrub(data['riskLevel'], 12) : undefined,
        executed: data?.['executed'] === true,
        note: typeof data?.['note'] === 'string' ? scrub(data['note'], 100) : undefined,
        steps: steps.slice(0, MAX_STEPS).map(s => ({ label: scrub(obj(s)?.['label'], 60), detail: scrub(obj(s)?.['detail'], 120) })),
        evidence: arr(data?.['evidence'])
          .slice(0, MAX_EVIDENCE)
          .map(e => ({ k: scrub(obj(e)?.['k'], 24), v: scrub(obj(e)?.['v'], 80) })),
      }
    }

    const facts = arr(data?.['facts']).filter((f): f is string => typeof f === 'string')
    const blocks = arr(data?.['blocks']).map(b => ({ title: scrub(obj(b)?.['title'], 60), kind: scrub(obj(b)?.['kind'], 16) }))
    if (facts.length === 0 && blocks.length === 0) return { ...base, kind: 'generic', facts: [], note: 'Nothing to show for this answer.' }

    return {
      ...base,
      kind: name.startsWith('lens_team_') || name === 'lens_review_queue' ? 'team' : 'generic',
      facts: facts.slice(0, MAX_FACTS).map(f => scrub(f, 160)),
      blocks: blocks.slice(0, MAX_BLOCKS),
    }
  } catch {
    return undefined
  }
}

/** Newest first, no repeat of the same tool and question, at most `max`. */
export const pushAsk = (items: Ask[], next: Ask, max = 5): Ask[] =>
  [next, ...items.filter(a => !(a.tool === next.tool && a.system === next.system && a.asked === next.asked))].slice(0, max)

/**
 * The component the pane is showing: the repository the person chose, else the one the session is in, else the one Claude's
 * own tool calls touched last, else the first catalog match; then the tab they picked, else its first component.
 * The same choice the pane makes when it draws the repository panels.
 */
export const pickActiveMatch = (d: Data, u: Ui, cwd: string): Match | undefined => {
  const roots = d.repos.map(r => r.root)
  const cwdRoot = d.repos.length === 0 ? undefined : rootContaining(cwd, roots)
  const activeRoot = [u.chosenRoot, cwdRoot, u.touchedRoot].find(r => r !== undefined && roots.includes(r)) ?? d.repos.find(r => r.matches.length > 0)?.root
  const matches = d.repos.find(r => r.root === activeRoot)?.matches ?? []

  return matches.find(m => m.entityRef === u.activeEntity) ?? matches[0]
}

const SEGMENT = /^[A-Za-z0-9._-]+$/
const ENTITY = /^(component|system):[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/i

/**
 * A link into PlatformNEX's Agent mode ("Plan a change"): the System's Components page, with `Plan: <the change>` in the
 * composer and the identified component as context. Opening it sends nothing. `system` is `<ns>/<name>` (no `system:`).
 * The component is only named when it belongs to that System; anything that does not look like a ref is left out.
 */
export const handoffUrl = (base: string, system: string | undefined, asked: string | undefined, component: { ref: string; systemRefs: string[] } | undefined): string | undefined => {
  const parts = (system ?? '').split('/')
  if (parts.length !== 2 || !parts.every(p => SEGMENT.test(p))) return undefined
  const query = new URLSearchParams({ assistant: 'agent', text: `Plan: ${scrub(asked ?? '', 300)}`.trim() })
  const inSystem = component !== undefined && ENTITY.test(component.ref) && component.systemRefs.some(r => r.toLowerCase() === `system:${system}`.toLowerCase())
  if (component !== undefined && inSystem) query.set('entity', component.ref)

  return `${base}/s/${encodeURIComponent(parts[0] ?? '')}/${encodeURIComponent(parts[1] ?? '')}/components?${query.toString()}`
}
