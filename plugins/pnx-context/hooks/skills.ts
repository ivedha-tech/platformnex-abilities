// What the pane keeps of a change plan: a small, capped, scrubbed record. Pure, so it can be tested without the engine.
import { cap, rootContaining } from './lib'
import type { Ask, Data, Match, Ui } from '../types'

/** The tool the mod itself offers: `mcp__pnx-context__pnx_plan_change`. */
export const OWN_PREFIX = 'mcp__pnx-context__'

/** The tool's own name without the server prefix: `plan_propose`, `pnx_plan_change`. */
export const bareName = (tool: string): string => tool.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '')

const MAX_STEPS = 8
const MAX_EVIDENCE = 8
const MAX_RAW = 200_000

// A key, a bearer or a JWT must never reach the screen or the stored state, whatever a server answers.
const SECRET = /pnx_[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]*)?/g
export const scrub = (value: unknown, max: number): string => cap(String(value ?? '').replace(SECRET, '[hidden]'), max)

const obj = (v: unknown): Record<string, unknown> | undefined => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** Turns a change-plan answer (or why asking failed) into an Ask. Any other tool's answer is not kept. Never throws. */
export const parseAsk = (tool: string, input: unknown, text: string | undefined, isError: boolean, now: number): Ask | undefined => {
  try {
    const name = bareName(tool)
    if (name !== 'plan_propose') return undefined
    const args = obj(input)
    const system = typeof args?.['systemRef'] === 'string' ? scrub((args['systemRef'] as string).replace(/^system:/i, ''), 60) : undefined
    const asked = typeof args?.['summary'] === 'string' ? scrub(args['summary'], 120) : undefined
    const base = { id: `${now}-${name}`, tool: name, at: now, title: 'CHANGE PLAN', system, asked }
    const failed = (note: string): Ask => ({ ...base, kind: 'error', note })

    // An error says why (the server's own words, scrubbed and cut), so a tool the server doesn't have reads as that, not as an empty panel.
    if (isError || text === undefined || text.length > MAX_RAW) return failed(isError && text !== undefined && text.trim() !== '' ? scrub(text, 160) : isError ? 'The tool reported an error.' : 'No answer to show.')

    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return failed(scrub(text, 160))
    }
    const data = obj(body)
    if (typeof data?.['error'] === 'string') return failed(scrub(data['error'], 160))

    const steps = arr(data?.['planSteps'])
    if (steps.length === 0) return failed('Nothing to show for this answer.')

    return {
      ...base,
      kind: 'plan',
      risk: typeof data?.['riskLevel'] === 'string' ? scrub(data['riskLevel'], 12) : undefined,
      executed: data?.['executed'] === true,
      note: typeof data?.['note'] === 'string' ? scrub(data['note'], 100) : undefined,
      steps: steps.slice(0, MAX_STEPS).map(s => ({ label: scrub(obj(s)?.['label'], 60), detail: scrub(obj(s)?.['detail'], 120) })),
      evidence: arr(data?.['evidence'])
        .slice(0, MAX_EVIDENCE)
        .map(e => ({ k: scrub(obj(e)?.['k'], 24), v: scrub(obj(e)?.['v'], 80) })),
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
