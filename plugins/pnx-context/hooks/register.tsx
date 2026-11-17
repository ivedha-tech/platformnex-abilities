import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { ApiFailure, byRepo, checkAccess, createDraftRelease, mcpCall, openReleases, snapshots, systemHealth, type Cfg, type CheckStep } from './api'
import {
  ago,
  baseName,
  buildTone,
  cap,
  compact,
  cleanRemote,
  daysAtRisk,
  dedupeByRemote,
  healthLabel,
  healthTone,
  isRepoUrl,
  normalizeRepoUrl,
  parseBuilds,
  parseByRepo,
  parseHealth,
  parsePrs,
  parseReleases,
  parseScan,
  passRate,
  parseSeries,
  releaseBlock,
  rootContaining,
  safeBaseUrl,
  spark,
  systemPath,
  type ParsedMatch,
  type ScannedRepo,
} from './lib'
import { OWN_PREFIX, handoffUrl, isPnxTool, parseAsk, pickActiveMatch, pushAsk, scrub, textOf } from './skills'
import type { Ask, Asks, Data, Match, RepoView, Ui } from '../types'

const PANE = 'pnx-context'
const TITLE = 'PlatformNEX'
const TICK_MS = 15_000
const DETAIL_MS = 120_000
const LOOKUP_MS = 30 * 60_000
const LOOKUP_RETRY_MS = 60_000
const SCAN_MS = 10 * 60_000
const MAX_LOOKUPS = 40
const MAX_MATCHES = 3
const PAGE_SIZE = 8

const EMPTY_DATA: Data = { at: 0, status: 'unconfigured', repos: [] }
const EMPTY_UI: Ui = {}
const EMPTY_ASKS: Asks = { items: [] }

// Change a tag when the stored fields change: it declines what an earlier version stored.
const data = atom({ plugin: 'pnx-context', key: 'data' } as const, EMPTY_DATA, { shape: 'data-1' })
const ui = atom({ plugin: 'pnx-context', key: 'ui' } as const, EMPTY_UI, { shape: 'ui-5' })
// What PlatformNEX tools answered lately, cut down to what the pane draws.
const asks = atom({ plugin: 'pnx-context', key: 'asks' } as const, EMPTY_ASKS, { shape: 'asks-1' })

// Every repository under the folder the session is in, one line each: folder, remote, branch, short sha.
const SCAN =
  'find "$PWD" -maxdepth 3 \\( -name node_modules -o -name .terraform \\) -prune -o -name .git -print 2>/dev/null | head -80 | ' +
  'while read -r g; do d=$(dirname "$g"); ' +
  'printf \'%s\\t%s\\t%s\\t%s\\n\' "$d" "$(git -C "$d" remote get-url origin 2>/dev/null)" "$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)" "$(git -C "$d" rev-parse --short HEAD 2>/dev/null)"; done'
const ONE =
  'd="$1"; printf \'%s\\t%s\\t%s\\t%s\\n\' "$d" "$(git -C "$d" remote get-url origin 2>/dev/null)" "$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)" "$(git -C "$d" rev-parse --short HEAD 2>/dev/null)"'

// Held in the module (a hot reload starts them over, which only costs one refresh).
let scan: { cwd: string; at: number; repos: ScannedRepo[] } | undefined
const lookups = new Map<string, { at: number; matches?: ParsedMatch[]; failed?: string }>()
const details = new Map<string, { at: number; match: Match }>()
let isBusy = false

const readCfg = (options: Readonly<Record<string, unknown>>): Cfg | undefined => {
  const base = safeBaseUrl(options['baseUrl'])
  const key = typeof options['apiKey'] === 'string' ? options['apiKey'].trim() : ''

  return base === undefined || key === '' ? undefined : { base, key }
}

const failure = (error: unknown): string => (error instanceof ApiFailure ? error.reason : 'something went wrong')

const discover = async ($: EngineInterface, force: boolean): Promise<{ cwd: string; repos: ScannedRepo[] }> => {
  const cwd = await $.session.cwd()
  const now = await $.clock.now()
  if (!force && scan !== undefined && scan.cwd === cwd && now - scan.at < SCAN_MS) return { cwd, repos: scan.repos }

  const repo = await $.session.repo()
  const ran = await $.process.run(repo === null ? ['sh', '-c', SCAN] : ['sh', '-c', ONE, 'sh', repo.root], { timeoutMs: 20_000 }).catch(() => undefined)
  const repos = dedupeByRemote(ran === undefined ? [] : parseScan(ran.stdout), cwd)
  scan = { cwd, at: now, repos }

  return { cwd, repos }
}

/** Which Components a remote belongs to, remembered for a while. A failure is remembered only briefly. */
const lookup = async ($: EngineInterface, cfg: Cfg, remote: string, force: boolean): Promise<{ matches?: ParsedMatch[]; failed?: string }> => {
  const key = normalizeRepoUrl(remote)
  const now = await $.clock.now()
  const known = lookups.get(key)
  if (!force && known !== undefined && now - known.at < (known.failed === undefined ? LOOKUP_MS : LOOKUP_RETRY_MS)) return known
  try {
    const reply = await byRepo($, cfg, cleanRemote(remote))
    const entry = { at: now, matches: parseByRepo(reply.data) }
    lookups.set(key, entry)

    return entry
  } catch (error) {
    const entry = { at: now, failed: error instanceof ApiFailure && error.status === 404 ? 'this PlatformNEX does not have the repo lookup yet' : failure(error) }
    lookups.set(key, entry)

    return entry
  }
}

const loadDetail = async ($: EngineInterface, cfg: Cfg, match: ParsedMatch, force: boolean): Promise<Match> => {
  const now = await $.clock.now()
  const known = details.get(match.entityRef)
  if (!force && known !== undefined && now - known.at < DETAIL_MS) return known.match

  const out: Match = { ...match, detailAt: now }
  const notes: string[] = []
  const system = match.systemRefs.map(systemPath).find((p): p is string => p !== undefined)
  const [health, snaps, releases] = await Promise.allSettled([
    system === undefined ? Promise.reject(new ApiFailure('not part of a System')) : systemHealth($, cfg, system),
    snapshots($, cfg, [
      { domain: 'devops', resourceType: 'pr-list', resourceKey: match.entityRef },
      { domain: 'devops', resourceType: 'pipelines', resourceKey: match.entityRef },
      { domain: 'sre', resourceType: 'metrics-requests', resourceKey: match.entityRef },
    ]),
    openReleases($, cfg, match.entityRef),
  ])

  if (health.status === 'fulfilled') out.health = parseHealth(health.value.data, match.entityRef)
  else notes.push(`health: ${failure(health.reason)}`)

  if (snaps.status === 'fulfilled') {
    const entries = (snaps.value.data as { entries?: unknown } | undefined)?.entries
    const at = (i: number): { payload?: unknown; status?: unknown } | undefined => (Array.isArray(entries) ? (entries[i] as { payload?: unknown; status?: unknown } | null) ?? undefined : undefined)
    const prs = at(0)
    const builds = at(1)
    const metrics = at(2)
    out.prs = prs?.payload === undefined ? undefined : parsePrs(prs.payload)
    out.builds = builds?.payload === undefined ? undefined : parseBuilds(builds.payload)
    const requests = metrics?.payload === undefined ? [] : parseSeries(metrics.payload)
    out.requests = requests.length === 0 ? undefined : requests
    if (prs === undefined) notes.push('pull requests: not collected yet')
    else if (prs.status === 'error') notes.push('pull requests: last refresh failed, showing the previous list')
  } else notes.push(`cached data: ${failure(snaps.reason)}`)

  if (releases.status === 'fulfilled') out.releases = parseReleases(releases.value.data)
  else notes.push(`releases: ${failure(releases.reason)}`)

  out.detailNote = notes.length === 0 ? undefined : cap(notes.join('; '), 160)
  details.set(match.entityRef, { at: now, match: out })

  return out
}

const refresh = async ($: EngineInterface, cfg: Cfg | undefined, force: boolean): Promise<void> => {
  if (isBusy) return
  isBusy = true
  try {
    const now = await $.clock.now()
    if (cfg === undefined) {
      await update($, data, (): Data => ({ at: now, status: 'unconfigured', repos: [] }))
      $.ui.status(undefined)

      return
    }

    const { cwd, repos: scanned } = await discover($, force)
    const state = await read($, ui)
    const views: RepoView[] = []
    let failed: string | undefined
    for (const repo of scanned.slice(0, MAX_LOOKUPS)) {
      const base = { root: repo.root, name: baseName(repo.root), remote: repo.remote, branch: repo.branch, head: repo.head }
      if (repo.remote === undefined || !isRepoUrl(repo.remote)) {
        views.push({ ...base, lookup: 'none', matches: [] })
        continue
      }
      const found = await lookup($, cfg, repo.remote, force)
      if (found.failed !== undefined) failed = found.failed
      views.push({ ...base, lookup: found.failed !== undefined ? 'error' : (found.matches ?? []).length > 0 ? 'found' : 'none', matches: (found.matches ?? []) as Match[] })
    }

    // Only the repository on screen is read in detail; the rest wait until the person picks them.
    const roots = views.map(v => v.root)
    const activeRoot = [state.chosenRoot, rootContaining(cwd, roots), state.touchedRoot].find(r => r !== undefined && roots.includes(r)) ?? views.find(v => v.matches.length > 0)?.root
    const filled = await Promise.all(
      views.map(async v =>
        v.root === activeRoot && v.matches.length > 0
          ? { ...v, matches: await Promise.all(v.matches.slice(0, MAX_MATCHES).map(m => loadDetail($, cfg, m as ParsedMatch, force))) }
          : v,
      ),
    )

    const result: Data = { at: now, status: failed !== undefined && filled.every(v => v.lookup !== 'found') ? 'error' : 'ok', error: failed, repos: filled }
    await update($, data, () => result)

    const active = filled.find(v => v.root === activeRoot)?.matches[0]
    $.ui.status(active === undefined ? undefined : `${active.name} · ${healthLabel(active.health?.status ?? 'unknown')}`)
  } catch (error) {
    await update($, data, (before): Data => ({ ...before, status: 'error', error: failure(error) })).catch(() => undefined)
  } finally {
    isBusy = false
  }
}

const portalLink = (cfg: Cfg, entityRef: string, sessionId: string): string | undefined => {
  const hit = /^component:([^/\s]+)\/([^/\s]+)$/i.exec(entityRef)

  return hit === null ? undefined : `${cfg.base}/catalog/component/${encodeURIComponent(hit[1] ?? '')}/${encodeURIComponent(hit[2] ?? '')}/releases/${encodeURIComponent(sessionId)}`
}

/** The one write: a DRAFT release session. If one is already open for that environment, it is reused. */
const confirmDraft = async ($: EngineInterface, cfg: Cfg, pending: NonNullable<Ui['pending']>): Promise<void> => {
  try {
    const open = parseReleases((await openReleases($, cfg, pending.entityRef)).data)
    const existing = open.find(r => r.environment === pending.environmentName)
    if (existing !== undefined) {
      await update($, ui, u => ({ ...u, pending: undefined, notice: { text: `A release to ${pending.environmentName} is already open (${existing.status}).`, url: portalLink(cfg, pending.entityRef, existing.id) } }))

      return
    }
    const reply = await createDraftRelease($, cfg, { entityRef: pending.entityRef, environmentId: pending.environmentId, targetKind: 'branch', targetRef: pending.branch })
    const body = reply.data as { session?: { id?: unknown }; id?: unknown } | undefined
    const id = typeof body?.session?.id === 'string' ? body.session.id : typeof body?.id === 'string' ? body.id : undefined
    await update($, ui, u => ({
      ...u,
      pending: undefined,
      notice: {
        text: id === undefined ? 'Draft release opened. Find it in the portal.' : `Draft release opened for ${pending.environmentName}. Review and deploy it in the portal.`,
        url: id === undefined ? undefined : portalLink(cfg, pending.entityRef, id),
      },
    }))
  } catch (error) {
    await update($, ui, u => ({ ...u, pending: undefined, notice: { text: `Could not open a draft release: ${failure(error)}` } }))
  }
  void refresh($, cfg, true).catch(() => undefined)
}


// Without this Claude answers "what is the team working on" from the local checkout. It names no one and no key.
const ROUTING =
  'PlatformNEX: when the person asks about a PlatformNEX System or its team (what a team is working on, who is blocked, review queue, health, cost, tests), call pnx_lens instead of reading the local repository or git history; ' +
  "for 'what is the team working on' use lens_team_activity with range 7d, then lens_team_blocked. To create or plan a change in a System, call pnx_plan_change; it only plans and creates nothing, so say that. " +
  'Name a System as system:default/<name>, e.g. system:default/speakupnex. The answer also appears in the PlatformNEX pane.'

/** Keeps one tool answer for the pane and brings the pane up. It never throws. */
const record = async ($: EngineInterface, tool: string, input: unknown, text: string | undefined, isError: boolean): Promise<void> => {
  const ask = parseAsk(tool, input, text, isError, await $.clock.now())
  if (ask === undefined) return
  await update($, asks, a => ({ items: pushAsk(a.items, ask) }))
  await update($, ui, u => ({ ...u, askHidden: undefined, askOpen: false }))
  void $.ui
    .open({ id: PANE, title: TITLE })
    .then(() => $.ui.scroll({ in: PANE, to: 'start' }))
    .catch(() => undefined)
}

const LENS_TOOLS = ['lens_team_roster', 'lens_team_activity', 'lens_team_blocked', 'lens_review_queue', 'lens_team_stats', 'lens_ai_usage', 'lens_system_health', 'lens_cost', 'lens_tests', 'lens_topology', 'lens_errors_by_component', 'lens_slowest_routes', 'lens_get_view'] as const
const RANGES = ['today', '7d', '30d', '90d']

/** Only the arguments a Lens tool takes, each checked; anything else the model sent is dropped. */
const lensArgs = (input: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  const text = (k: string, max: number): void => {
    const v = input[k]
    if (typeof v === 'string' && v.trim() !== '' && v.length <= max) out[k] = v.trim()
  }
  text('systemRef', 120)
  text('environment', 40)
  text('focus', 160)
  text('id', 60)
  if (typeof input['range'] === 'string' && RANGES.includes(input['range'])) out['range'] = input['range']
  if (typeof input['groupBy'] === 'string' && ['feature', 'model', 'person'].includes(input['groupBy'])) out['groupBy'] = input['groupBy']
  if (typeof input['person'] === 'number' && Number.isInteger(input['person']) && input['person'] > 0) out['person'] = input['person']

  return out
}

type Options = Readonly<Record<string, unknown>>

const keyOf = (options: Options): string => (typeof options['apiKey'] === 'string' ? options['apiKey'].trim() : '')
const urlOf = (options: Options): string => (typeof options['baseUrl'] === 'string' ? options['baseUrl'].trim() : '')

/** What to run to save the key, as plain text for the transcript so it can be copied. Never contains a key. */
const setupText = (options: Options): string => {
  const url = urlOf(options)

  return [
    'Set up PlatformNEX (pnx-context)',
    '',
    `1. Create a personal API key in the portal: user menu, API keys${safeBaseUrl(url) === undefined ? '' : ` (${safeBaseUrl(url)}/account/api-keys)`}.`,
    '   It starts with pnx_. Do not paste it into chat or a file.',
    '',
    '2. Save it. In your own terminal, this keeps the key out of your shell history:',
    '',
    `   read -rs K && printf '{"apiKey":"%s"}' "$K" | claude plugin configure pnx-context@platformnex-abilities --values-stdin; unset K`,
    '',
    '   Or inside Claude Code: /plugin configure pnx-context@platformnex-abilities',
    '',
    '3. Restart Claude Code, then run /pnx-context check.',
    '',
    url === '' ? 'Portal address: not set (add "baseUrl" to the same JSON).' : `Portal address: ${url}. To use another, add "baseUrl" to the same JSON.`,
  ].join('\n')
}

const formatSteps = (steps: CheckStep[]): string =>
  steps
    .flatMap(step => [
      `  ${step.ok === true ? '✓' : step.ok === false ? '✗' : '·'} ${step.label.padEnd(14)}${step.detail}`,
      ...(step.ok === false && step.fix !== undefined ? [`    -> ${step.fix}`] : []),
    ])
    .join('\n')

/** `/pnx-context check`: each step in order, with what to do about the first one that fails. The key is never shown. */
const checkText = async ($: EngineInterface, options: Options): Promise<string> => {
  const url = urlOf(options)
  const key = keyOf(options)
  const base = safeBaseUrl(url)
  const steps: CheckStep[] = [
    { label: 'URL set', ok: url !== '', detail: url === '' ? 'not set' : url, fix: url === '' ? 'run /pnx-context setup' : undefined },
    { label: 'URL is https', ok: url === '' ? undefined : base !== undefined, detail: base !== undefined ? 'yes' : url === '' ? 'skipped' : 'it must look like https://host, with no path', fix: url !== '' && base === undefined ? 'set the baseUrl option again' : undefined },
    { label: 'API key set', ok: key !== '', detail: key === '' ? 'not set' : '(hidden)', fix: key === '' ? 'run /pnx-context setup' : undefined },
    { label: 'key format', ok: key === '' ? undefined : key.startsWith('pnx_'), detail: key === '' ? 'skipped' : key.startsWith('pnx_') ? 'looks right' : 'a personal key starts with pnx_', fix: key !== '' && !key.startsWith('pnx_') ? 'create a key in the portal (user menu, API keys)' : undefined },
  ]
  const cfg = readCfg(options)
  const stop = steps.some(s => s.ok === false)
  const rest = stop || cfg === undefined ? [{ label: 'key accepted', ok: undefined, detail: 'skipped until the steps above pass' } as CheckStep, { label: 'lookup route', ok: undefined, detail: 'skipped' } as CheckStep] : await checkAccess($, cfg)
  const all = [...steps, ...rest]
  const ready = all.every(s => s.ok === true)

  return ['PlatformNEX check', '', formatSteps(all), '', ready ? 'Ready. Open the pane with /pnx-context.' : 'Not ready yet: fix the first ✗ above, restart Claude Code, then run /pnx-context check again.'].join('\n')
}

/** The Agent mode link for a plan, naming the component the pane has identified. Never throws. */
async function handoff($: EngineInterface, cfg: Cfg, args: Record<string, unknown>): Promise<string | undefined> {
  try {
    const system = typeof args['systemRef'] === 'string' ? args['systemRef'].replace(/^system:/i, '') : undefined
    const asked = typeof args['summary'] === 'string' ? args['summary'] : undefined
    const match = pickActiveMatch(await read($, data), await read($, ui), await $.session.cwd())

    return handoffUrl(cfg.base, system, asked, match === undefined ? undefined : { ref: match.entityRef, systemRefs: match.systemRefs })
  } catch {
    return undefined
  }
}

/** Asks the gateway as the person for the model's tool, keeps the answer for the pane, and answers the model with it. */
async function serve($: EngineInterface, cfg: Cfg | undefined, name: string, args: Record<string, unknown>): Promise<{ result: string } | { deny: string }> {
  if (cfg === undefined) return { deny: 'PlatformNEX is not set up. Run /pnx-context setup.' }
  try {
    const reply = await mcpCall($, cfg, name, args)
    await record($, `${OWN_PREFIX}${name}`, args, reply.text, reply.isError).catch(() => undefined)
    if (reply.isError) return { deny: scrub(reply.text === '' ? 'the tool reported an error' : reply.text, 300) }
    const link = name === 'plan_propose' ? await handoff($, cfg, args) : undefined
    const answer = reply.text === '' ? 'No answer.' : reply.text

    return { result: link === undefined ? answer : `${answer}\n\nTo plan this for real, open PlatformNEX Agent mode (nothing is sent until the person sends it): ${link}` }
  } catch (error) {
    return { deny: `PlatformNEX: ${failure(error)}` }
  }
}

export const register: Register = (on, options) => {
  const cfg = readCfg(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'pnx-context', description: 'Show the PlatformNEX component, health and pull requests for this repo' })
    void $.ui.open({ id: PANE, title: TITLE })
    if (cfg !== undefined) {
      // The model's way to ask PlatformNEX. Both are read-only; the answer is also drawn in the pane.
      void $.tool
        .register({
          name: 'pnx_plan_change',
          isDeferred: false,
          description:
            "Plan a change in a PlatformNEX System, e.g. 'create a change for me in speakupnex'. Returns the steps in order, starting with a ServiceNEX ticket, plus the System's environments and approval gates. It is a plan only: nothing is created, so tell the person and let them decide. The plan also appears in the PlatformNEX pane. The result ends with a link to PlatformNEX Agent mode, where the real plan is made: give that link to the person.",
          inputSchema: {
            type: 'object',
            properties: { systemRef: { type: 'string', description: "The System's ref, e.g. system:default/speakupnex" }, summary: { type: 'string', description: 'What the change is, in one sentence' } },
            required: ['systemRef', 'summary'],
          },
        })
        .catch(() => undefined)
      void $.tool
        .register({
          name: 'pnx_lens',
          isDeferred: false,
          description:
            "Ask PlatformNEX Lens about a System: what the team is working on (lens_team_activity, lens_team_blocked, lens_review_queue, lens_team_stats), its health, cost, AI usage, tests or topology. Read-only. The answer also appears in the PlatformNEX pane. For 'what is my team working on' use lens_team_activity with range 7d, then lens_team_blocked.",
          inputSchema: {
            type: 'object',
            properties: {
              // Not named `tool`: that key of a tool call is the tool's own name, so an argument called tool is never read.
              lens: { type: 'string', enum: [...LENS_TOOLS] },
              systemRef: { type: 'string', description: "The System's ref, e.g. system:default/forcenex" },
              range: { type: 'string', enum: RANGES },
              person: { type: 'number', description: 'A userId from lens_team_roster' },
              groupBy: { type: 'string', enum: ['feature', 'model', 'person'] },
              environment: { type: 'string' },
              focus: { type: 'string' },
              id: { type: 'string', description: 'A saved view id, for lens_get_view' },
            },
            required: ['lens'],
          },
        })
        .catch(() => undefined)
    }
    void refresh($, cfg, true).catch(() => undefined)
    $.clock.every(TICK_MS, () => void refresh($, cfg, false).catch(() => undefined))

    return next(e)
  })

  on('command.run', { command: 'pnx-context' }, async ($, e) => {
    const word = e.args.trim()
    if (word === 'setup') return { text: setupText(options) }
    if (word === 'check') return { text: await checkText($, options) }
    await $.ui.open({ id: PANE, title: TITLE })
    void refresh($, cfg, e.args.trim() === 'refresh').catch(() => undefined)

    return { text: cfg === undefined ? 'PlatformNEX pane opened, but it is not set up yet. Run /pnx-context setup.' : 'PlatformNEX pane opened. If it shows an error, run /pnx-context check.' }
  })

  // The two tools above: ask the gateway as the person and answer the model with what it said.
  // Tells the model when to use the two tools, once configured.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (cfg === undefined) return composed

    return { sections: [...composed.sections, { id: 'pnx-context-routing', text: ROUTING, scope: 'session' as const }] }
  })

  const fields = (e: unknown): Record<string, unknown> => (e !== null && typeof e === 'object' ? (e as Record<string, unknown>) : {})

  on('tool.call', { tool: `${OWN_PREFIX}pnx_plan_change` }, async ($, e) => {
    const input = fields(e)
    const systemRef = typeof input['systemRef'] === 'string' ? input['systemRef'].trim() : ''
    const summary = typeof input['summary'] === 'string' ? input['summary'].trim() : ''
    if (systemRef === '' || summary.length < 3) return { deny: 'Both systemRef and summary are needed.' }

    return serve($, cfg, 'plan_propose', { systemRef: systemRef.slice(0, 120), summary: summary.slice(0, 500) })
  })

  on('tool.call', { tool: `${OWN_PREFIX}pnx_lens` }, async ($, e) => {
    const input = fields(e)
    const name = typeof input['lens'] === 'string' ? input['lens'] : ''
    if (!(LENS_TOOLS as readonly string[]).includes(name)) return { deny: `Unknown Lens tool. Use one of: ${LENS_TOOLS.join(', ')}.` }

    return serve($, cfg, name, lensArgs(input))
  })

  // Notes which repository Claude's own file reads and edits touch, so the pane can follow the work; and keeps what a
  // PlatformNEX tool answered (from any MCP config) so the pane can draw it. The call itself is never changed.
  on('tool.call', async ($, e, next) => {
    try {
      const path = (e as unknown as { file_path?: unknown }).file_path
      if (typeof path === 'string' && path.startsWith('/')) {
        const root = rootContaining(path, (await read($, data)).repos.map(r => r.root))
        if (root !== undefined && root !== (await read($, ui)).touchedRoot) await update($, ui, u => ({ ...u, touchedRoot: root }))
      }
    } catch {
      // Never let the pane get in the way of a tool call.
    }

    const result = await next(e)

    try {
      const tool = (e as unknown as { tool?: unknown }).tool
      if (isPnxTool(tool) && !tool.startsWith(OWN_PREFIX)) {
        const out = result as unknown as { result?: unknown; isError?: unknown }
        await record($, tool, e, textOf(out?.result), out?.isError === true)
      }
    } catch {
      // Same: a failure here is the pane's, not the call's.
    }

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const d = await read($, data)
    const u = await read($, ui)
    const heard = await read($, asks)
    const columns = Math.max(24, e.props.bodyColumns ?? 40)
    // Room inside a panel: the border and one space of padding on each side.
    const inner = Math.max(16, columns - 4)
    // The short notes beside the gauges need room; narrow panes drop them.
    const roomy = inner >= 46
    const now = await $.clock.now()
    const act = (run: () => Promise<unknown>) => () => void run().catch(() => undefined)
    const rule = <Text dimColor>{'─'.repeat(Math.max(10, columns))}</Text>

    // One bordered panel: title and a short summary on the first row, both in the panel's colour.
    const panel = (title: string, accent: string, right: JSX.Element | undefined, body: JSX.Element) => (
      <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={accent}>
            {cap(title, Math.max(8, inner - 14))}
          </Text>
          {right}
        </Box>
        {body}
      </Box>
    )

    if (d.status === 'unconfigured' || cfg === undefined) {
      const set = Number(safeBaseUrl(urlOf(options)) !== undefined) + Number(keyOf(options) !== '')

      return panel(
        'SET UP PLATFORMNEX',
        'warning',
        <Text dimColor>{set} of 2 set</Text>,
        <Box flexDirection="column">
          <Text>1  Create an API key in the portal</Text>
          <Text dimColor>   user menu, API keys</Text>
          <Text>2  Save it: run /pnx-context setup</Text>
          <Text dimColor>   and copy the command it prints</Text>
          <Text>3  Restart Claude Code, then run</Text>
          <Text dimColor>   /pnx-context check</Text>
        </Box>,
      )
    }

    const roots = d.repos.map(r => r.root)
    const cwdRoot = d.repos.length === 0 ? undefined : rootContaining(await $.session.cwd(), roots)
    const activeRoot = [u.chosenRoot, cwdRoot, u.touchedRoot].find(r => r !== undefined && roots.includes(r)) ?? d.repos.find(r => r.matches.length > 0)?.root
    const active = d.repos.find(r => r.root === activeRoot)
    const matched = d.repos.filter(r => r.matches.length > 0).length
    const shown = active === undefined ? [] : active.matches.slice(0, MAX_MATCHES)
    const current = shown.find(m => m.entityRef === u.activeEntity) ?? shown[0]
    const currentStatus = current?.health?.status ?? 'unknown'

    // Catalog repositories first (the sort is stable, so the scan order holds within each group).
    const ordered = [...d.repos].sort((a, b) => Number(b.matches.length > 0) - Number(a.matches.length > 0))
    const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE))
    const page = Math.min(Math.max(0, u.page ?? 0), pages - 1)
    const pageRepos = ordered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

    const newest: Ask | undefined = heard.items.find(a => a.id !== u.askHidden)
    const askOpen = u.askOpen === true
    const planUrl = newest?.kind === 'plan' ? handoffUrl(cfg.base, newest.system, newest.asked, current === undefined ? undefined : { ref: current.entityRef, systemRefs: current.systemRefs }) : undefined
    const FACTS_SHORT = 3
    const expandable = (k: Ask): boolean => (k.kind === 'plan' ? (k.steps ?? []).length > 1 || (k.evidence ?? []).length > 0 : k.facts.length > FACTS_SHORT || (k.blocks ?? []).length > 0)
    const askPanel = (k: Ask) => {
      if (k.kind === 'plan') {
        const steps = k.steps ?? []
        const first = steps[0]
        const rest = steps.slice(1)

        return panel(
          k.title,
          'claude',
          <Text dimColor>{k.risk === undefined ? '' : `risk ${k.risk}`}</Text>,
          askOpen ? (
            <Box flexDirection="column">
              <Text dimColor>{cap(k.note ?? 'Plan only. Nothing has been created.', inner)}</Text>
              {steps.map((st, n) => (
                <Box flexDirection="column" key={`ask-step-${n}`}>
                  <Text bold={n === 0} color={n === 0 ? 'claude' : undefined}>{cap(`${n === 0 ? '▸' : ' '} ${n + 1} ${st.label}`, inner)}</Text>
                  {n === 0 && <Text dimColor>{cap(`    ${st.detail}`, inner)}</Text>}
                </Box>
              ))}
              {(k.evidence ?? []).map(ev => (
                <Text dimColor>{cap(`${ev.k}  ${ev.v}`, inner)}</Text>
              ))}
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>{cap(k.note ?? 'Plan only. Nothing has been created.', inner)}</Text>
              {first !== undefined && <Text bold color="claude">{cap(`▸ 1 ${first.label}`, inner)}</Text>}
              {rest.length > 0 && <Text dimColor>{cap(`  then: ${rest.map(st => st.label).join(' · ')}`, inner)}</Text>}
              {(k.evidence ?? []).length > 0 && <Text dimColor>{cap((k.evidence ?? []).map(ev => `${ev.k} ${ev.v}`).join('   '), inner)}</Text>}
            </Box>
          ),
        )
      }

      const shownFacts = askOpen ? k.facts : k.facts.slice(0, FACTS_SHORT)
      const hidden = k.facts.length - shownFacts.length

      return panel(
        k.title,
        k.kind === 'team' ? 'suggestion' : 'inactive',
        <Text dimColor>{ago(k.at, now)}</Text>,
        <Box flexDirection="column">
          {k.note !== undefined && <Text dimColor>{cap(k.note, inner * 2)}</Text>}
          {shownFacts.map(f => (
            <Text>{cap(`• ${f}`, askOpen ? inner * 2 : inner)}</Text>
          ))}
          {hidden > 0 && <Text dimColor>{`+ ${hidden} more`}</Text>}
          {askOpen && (k.blocks ?? []).length > 0 && <Text dimColor>{cap(`views: ${(k.blocks ?? []).map(b => b.title).join(' · ')}`, inner * 2)}</Text>}
        </Box>,
      )
    }

    const strip = (values: string[], tone: (v: string) => string) => (
      <Box flexDirection="row">
        {values.map(v => (
          <Text color={tone(v)}>█</Text>
        ))}
      </Box>
    )
    const lane = (label: string, content: JSX.Element, note: string | undefined) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row">
          <Text dimColor>{label.padEnd(12)}</Text>
          {content}
        </Box>
        {roomy && note !== undefined && <Text dimColor>{note}</Text>}
      </Box>
    )

    const componentPanel = (m: Match) => {
      const status = m.health?.status ?? 'unknown'
      const accent = healthTone(status)
      const risky = m.health === undefined ? 0 : daysAtRisk(m.health.history)
      const rate = m.builds === undefined ? undefined : passRate(m.builds)

      return panel(
        (m.title ?? m.name).toUpperCase(),
        accent,
        <Text color={accent}>● {healthLabel(status)}</Text>,
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>{cap(m.systemRefs.map(s => s.replace(/^system:/, '')).join(', ') || 'no System', Math.max(10, inner - 24))}</Text>
            {m.health?.computedAt !== undefined && <Text dimColor>updated {ago(m.health.computedAt, now)}</Text>}
          </Box>
          {((m.health?.history.length ?? 0) > 0 || (m.builds?.length ?? 0) > 0 || m.requests !== undefined) && <Text> </Text>}
          {m.health !== undefined && m.health.history.length > 0 && lane(`health ${m.health.history.length}d`, strip(m.health.history, healthTone), risky === 0 ? 'no days at risk' : `${risky} day${risky === 1 ? '' : 's'} at risk`)}
          {m.builds !== undefined && m.builds.length > 0 && lane(`builds ×${m.builds.length}`, strip(m.builds, buildTone), rate === undefined ? undefined : `${rate}% passing`)}
          {m.requests !== undefined && lane('requests', <Text color="claude">{spark(m.requests)}</Text>, `peak ${compact(Math.max(...m.requests))}`)}
          {(m.health?.reasons.length ?? 0) > 0 && <Text> </Text>}
          {(m.health?.reasons ?? []).map(r => (
            <Text color={accent === 'success' ? undefined : accent}>{cap(`⚠ ${r}`, inner)}</Text>
          ))}
          {m.detailNote !== undefined && <Text dimColor>{cap(m.detailNote, inner * 2)}</Text>}
        </Box>,
      )
    }

    const prPanel = (m: Match, repo: RepoView) => {
      const failing = (m.prs ?? []).filter(p => p.build === 'failure' || p.build === 'error').length

      return panel(
        'PULL REQUESTS',
        'suggestion',
        <Text dimColor>{m.prs === undefined ? 'not collected yet' : `${m.prs.length} open${failing > 0 ? ` · ${failing} ✗` : ''}`}</Text>,
        <Box flexDirection="column">
          {m.prs !== undefined && m.prs.length === 0 && <Text dimColor>No open pull requests</Text>}
          {(m.prs ?? []).slice(0, 6).map(pr => {
            const bad = pr.build === 'failure' || pr.build === 'error'
            const author = cap(pr.author, 12)
            const room = Math.max(8, inner - 4 - pr.number.length - author.length - 2)

            return (
              <Box flexDirection="row" justifyContent="space-between">
                <Box flexDirection="row">
                  <Text color={pr.build === 'success' ? 'success' : bad ? 'error' : 'inactive'}>{pr.build === 'success' ? '✓' : bad ? '✗' : '·'} </Text>
                  {pr.url === undefined ? <Text>#{pr.number}</Text> : <Link href={pr.url}>#{pr.number}</Link>}
                  <Text bold={pr.sourceBranch !== undefined && pr.sourceBranch === repo.branch}>{`  ${cap(pr.title, room)}`}</Text>
                </Box>
                <Text dimColor>{author}</Text>
              </Box>
            )
          })}
          {(m.prs?.length ?? 0) > 6 && <Text dimColor>+{(m.prs?.length ?? 0) - 6} more</Text>}
        </Box>,
      )
    }

    const releasePanel = (m: Match, repo: RepoView) => {
      const open = m.releases ?? []
      const choices = m.environments.map(env => ({ env, block: releaseBlock(env, repo.branch) }))

      return panel(
        'RELEASES',
        'claude',
        <Text dimColor>{open.length} open</Text>,
        <Box flexDirection="column">
          {open.length === 0 && <Text dimColor>No open releases</Text>}
          {open.map(r => (
            <Text>{cap(`${r.environment ?? 'environment'} · ${r.status}${r.target === undefined ? '' : ` · ${r.target}`}`, inner)}</Text>
          ))}
          <Text> </Text>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            <Text dimColor>open a draft:</Text>
            {choices
              .filter(c => c.block === undefined)
              .map(({ env }) => (
                <Button
                  key={`rel-${m.entityRef}-${env.id}`}
                  onPress={act(() => update($, ui, x => ({ ...x, notice: undefined, pending: { entityRef: m.entityRef, environmentId: env.id, environmentName: env.name, branch: repo.branch ?? '', head: repo.head } })))}
                >
                  {env.name}
                </Button>
              ))}
            {m.environments.length === 0 && <Text dimColor>no environments set up</Text>}
          </Box>
          {choices
            .filter(c => c.block !== undefined)
            .map(({ env, block }) => (
              <Text dimColor>{cap(`${env.name}: ${env.isProduction ? 'in the portal' : block}`, inner)}</Text>
            ))}
        </Box>,
      )
    }

    return (
      <Box flexDirection="column">
        {/* Header: what this is, where, and how fresh. */}
        <Box flexDirection="column" alignItems="center">
          <Text bold>{cap(`PLATFORMNEX${active === undefined ? '' : ` · ${active.name}`}`, columns)}</Text>
          <Box flexDirection="row">
            <Text dimColor>
              {`${active?.branch === undefined ? '' : `${cap(active.branch, 30)} · `}${matched} of ${d.repos.length} repos · ${ago(d.at, now)} `}
            </Text>
            <Button key="refresh" plain hotkey="r" onPress={act(() => refresh($, cfg, true))}>
              ⟳
            </Button>
          </Box>
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="row">
              <Text color={healthTone(currentStatus)}>■ </Text>
              <Text dimColor>health</Text>
            </Box>
            <Box flexDirection="row">
              <Text color="suggestion">■ </Text>
              <Text dimColor>pull requests</Text>
            </Box>
            <Box flexDirection="row">
              <Text color="claude">■ </Text>
              <Text dimColor>releases</Text>
            </Box>
          </Box>
        </Box>
        {d.status === 'error' && d.error !== undefined && <Text color="error">{cap(d.error, columns * 2)}</Text>}
        {rule}

        {/* The newest answer from a PlatformNEX tool: a plan, the team's work, or the facts it returned. */}
        {newest !== undefined && (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold>{cap(`ASK · ${newest.asked ?? newest.system ?? newest.title.toLowerCase()}`, Math.max(12, columns - 6))}</Text>
              <Box flexDirection="row" gap={1}>
                {expandable(newest) && (
                  <Button key="ask-toggle" plain hotkey="m" onPress={act(() => update($, ui, x => ({ ...x, askOpen: x.askOpen !== true })))}>
                    {askOpen ? 'm collapse' : 'm expand'}
                  </Button>
                )}
                <Button key="ask-dismiss" plain hotkey="x" onPress={act(() => update($, ui, x => ({ ...x, askHidden: newest.id, askOpen: false })))}>
                  x
                </Button>
              </Box>
            </Box>
            {askPanel(newest)}
            {newest.kind === 'plan' && planUrl !== undefined && (
              <Link href={planUrl}>↗ Plan this in PlatformNEX (Agent mode)</Link>
            )}
            {rule}
          </Box>
        )}

        {/* Every repository found here, catalog ones first, a page at a time. Letters pick one, n and p turn the page. */}
        {d.repos.length > 1 && (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold>REPOSITORIES · {d.repos.length}</Text>
              {pages > 1 && (
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>
                    {page + 1}/{pages}
                  </Text>
                  <Button key="page-prev" plain hotkey="p" onPress={act(() => update($, ui, x => ({ ...x, page: Math.max(0, page - 1) })))}>
                    ‹ p
                  </Button>
                  <Button key="page-next" plain hotkey="n" onPress={act(() => update($, ui, x => ({ ...x, page: Math.min(pages - 1, page + 1) })))}>
                    n ›
                  </Button>
                </Box>
              )}
            </Box>
            {pageRepos.map((r, i) => {
              const isActive = r.root === activeRoot
              const inCatalog = r.matches.length > 0
              const dot = isActive ? healthTone(currentStatus) : undefined
              const first = r.matches[0]
              const label = cap(`${first?.title ?? first?.name ?? r.name}${r.matches.length > 1 ? ` +${r.matches.length - 1}` : ''}`, Math.max(8, inner - 22))
              const where = inCatalog ? cap((first?.systemRefs[0] ?? 'no System').replace(/^system:/, ''), 16) : 'not in catalog'
              const letter = String.fromCharCode(97 + i)

              return (
                <Box flexDirection="row" justifyContent="space-between" key={`row-${r.root}`}>
                  {isActive ? (
                    <Box flexDirection="row">
                      <Text bold>{`▸ ${letter} `}</Text>
                      <Text color={dot}>● </Text>
                      <Text bold>{label}</Text>
                    </Box>
                  ) : (
                    <Button
                      key={`pick-${r.root}`}
                      plain
                      hotkey={letter}
                      onPress={act(async () => {
                        await update($, ui, x => ({ ...x, chosenRoot: r.root, activeEntity: undefined, pending: undefined, notice: undefined }))
                        await refresh($, cfg, true)
                      })}
                    >
                      {`  ${letter} ${inCatalog ? '●' : '○'} ${label}`}
                    </Button>
                  )}
                  <Text dimColor>{where}</Text>
                </Box>
              )
            })}
            {rule}
          </Box>
        )}

        {/* One tab for each component of this repository. */}
        {shown.length > 0 && (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={2}>
              {shown.map((m, i) => (
                <Button key={`tab-${m.entityRef}`} {...(m === current ? {} : { plain: true as const })} hotkey={String(i + 1)} onPress={act(() => update($, ui, x => ({ ...x, activeEntity: m.entityRef })))}>
                  {`${i + 1} ${cap(m.title ?? m.name, 18)} `}
                  <Text color={healthTone(m.health?.status ?? 'unknown')}>●</Text>
                </Button>
              ))}
            </Box>
            {rule}
          </Box>
        )}
        {active !== undefined && active.matches.length > MAX_MATCHES && <Text dimColor>+{active.matches.length - MAX_MATCHES} more components in this repository</Text>}

        {u.notice !== undefined && (
          <Box flexDirection="column">
            {panel(
              'Release',
              u.notice.text.startsWith('Could not') ? 'error' : 'success',
              undefined,
              <Box flexDirection="column">
                <Text>{cap(u.notice.text, inner * 2)}</Text>
                {u.notice.url !== undefined && <Link href={u.notice.url}>Open in the portal</Link>}
              </Box>,
            )}
            {rule}
          </Box>
        )}

        {u.pending !== undefined && (
          <Box flexDirection="column">
            {panel(
              'Open a draft release?',
              'warning',
              undefined,
              <Box flexDirection="column">
                <Text>{cap(`${u.pending.entityRef.replace(/^component:/, '')} to ${u.pending.environmentName}`, inner)}</Text>
                <Text>{cap(`branch ${u.pending.branch}${u.pending.head === undefined ? '' : ` (local ${u.pending.head})`}`, inner)}</Text>
                <Text dimColor>This opens a draft. It does not deploy.</Text>
                <Text> </Text>
                <Box flexDirection="row" gap={1}>
                  <Button key="confirm" variant="primary" onPress={act(() => confirmDraft($, cfg, u.pending!))}>
                    Open draft
                  </Button>
                  <Button key="cancel" onPress={act(() => update($, ui, x => ({ ...x, pending: undefined })))}>
                    Cancel
                  </Button>
                </Box>
              </Box>,
            )}
            {rule}
          </Box>
        )}

        {active === undefined && d.repos.length === 0 && <Text dimColor>No git repository found here.</Text>}
        {active !== undefined && active.lookup === 'none' && <Text dimColor>Not in the PlatformNEX catalog, or not visible to you.</Text>}
        {active !== undefined && active.lookup === 'error' && <Text color="error">Could not look this repository up.</Text>}

        {current !== undefined && active !== undefined && (
          <Box flexDirection="column">
            {componentPanel(current)}
            {rule}
            {prPanel(current, active)}
            {rule}
            {releasePanel(current, active)}
            {rule}
          </Box>
        )}
      </Box>
    )
  })
}
