import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { ApiFailure, byRepo, createDraftRelease, openReleases, snapshots, systemHealth, type Cfg } from './api'
import {
  ago,
  baseName,
  buildTone,
  cap,
  cleanRemote,
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
  parseSeries,
  releaseBlock,
  rootContaining,
  safeBaseUrl,
  spark,
  systemPath,
  type ParsedMatch,
  type ScannedRepo,
} from './lib'
import type { Data, Match, RepoView, Ui } from '../types'

const PANE = 'pnx-context'
const TITLE = 'PlatformNEX'
const TICK_MS = 15_000
const DETAIL_MS = 120_000
const LOOKUP_MS = 30 * 60_000
const LOOKUP_RETRY_MS = 60_000
const SCAN_MS = 10 * 60_000
const MAX_LOOKUPS = 40
const MAX_MATCHES = 3

const EMPTY_DATA: Data = { at: 0, status: 'unconfigured', repos: [] }
const EMPTY_UI: Ui = {}

// Change a tag when the stored fields change: it declines what an earlier version stored.
const data = atom({ plugin: 'pnx-context', key: 'data' } as const, EMPTY_DATA, { shape: 'data-1' })
const ui = atom({ plugin: 'pnx-context', key: 'ui' } as const, EMPTY_UI, { shape: 'ui-1' })

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
    const entry = { at: now, failed: failure(error) }
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

export const register: Register = (on, options) => {
  const cfg = readCfg(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'pnx-context', description: 'Show the PlatformNEX component, health and pull requests for this repo' })
    void $.ui.open({ id: PANE, title: TITLE })
    void refresh($, cfg, true).catch(() => undefined)
    $.clock.every(TICK_MS, () => void refresh($, cfg, false).catch(() => undefined))

    return next(e)
  })

  on('command.run', { command: 'pnx-context' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: TITLE })
    void refresh($, cfg, e.args.trim() === 'refresh').catch(() => undefined)

    return { text: cfg === undefined ? 'PlatformNEX pane opened. Set the URL and key first: claude plugin configure pnx-context@platformnex-abilities.' : 'PlatformNEX pane opened.' }
  })

  // Notes which repository Claude's own file reads and edits touch, so the pane can follow the work.
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

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const d = await read($, data)
    const u = await read($, ui)
    const columns = Math.max(24, e.props.bodyColumns ?? 40)
    // Room inside a card: the border and one space of padding on each side.
    const inner = Math.max(16, columns - 4)
    const now = await $.clock.now()
    const act = (run: () => Promise<unknown>) => () => void run().catch(() => undefined)

    // Every section is one rounded card, its title on the first row, coloured by what the card is about.
    const card = (title: string, accent: string, body: JSX.Element) => (
      <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1} marginBottom={1}>
        <Text bold color={accent}>
          {cap(title, inner)}
        </Text>
        {body}
      </Box>
    )

    if (d.status === 'unconfigured' || cfg === undefined) {
      return card(
        'PlatformNEX is not set up yet',
        'warning',
        <Box flexDirection="column">
          <Text dimColor>Set the portal URL and your API key with:</Text>
          <Text>  claude plugin configure pnx-context@platformnex-abilities</Text>
          <Text dimColor>The key comes from Settings, Account in the portal.</Text>
          <Text dimColor>Then restart Claude Code and run /pnx-context.</Text>
        </Box>,
      )
    }

    const roots = d.repos.map(r => r.root)
    const cwdRoot = d.repos.length === 0 ? undefined : rootContaining(await $.session.cwd(), roots)
    const activeRoot = [u.chosenRoot, cwdRoot, u.touchedRoot].find(r => r !== undefined && roots.includes(r)) ?? d.repos.find(r => r.matches.length > 0)?.root
    const active = d.repos.find(r => r.root === activeRoot)
    const others = d.repos.filter(r => r.root !== activeRoot && r.matches.length > 0)
    const matched = d.repos.filter(r => r.matches.length > 0).length

    const strip = (values: string[], tone: (v: string) => string) => (
      <Box flexDirection="row">
        {values.map(v => (
          <Text color={tone(v)}>█</Text>
        ))}
      </Box>
    )
    const series = (label: string, content: JSX.Element) => (
      <Box flexDirection="row">
        <Text dimColor>{label.padEnd(12)}</Text>
        {content}
      </Box>
    )

    const componentCard = (m: Match) => {
      const status = m.health?.status ?? 'unknown'
      const accent = healthTone(status)

      return card(
        m.title ?? m.name,
        accent,
        <Box flexDirection="column">
          <Text dimColor>{cap(m.systemRefs.map(s => s.replace(/^system:/, '')).join(', ') || 'no System', inner)}</Text>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={accent}>● {healthLabel(status)}</Text>
            {m.health?.computedAt !== undefined && <Text dimColor>updated {ago(m.health.computedAt, now)}</Text>}
          </Box>
          {((m.health?.history.length ?? 0) > 0 || (m.builds?.length ?? 0) > 0 || m.requests !== undefined) && <Text> </Text>}
          {m.health !== undefined && m.health.history.length > 0 && series(`Health ${m.health.history.length}d`, strip(m.health.history, healthTone))}
          {m.builds !== undefined && m.builds.length > 0 && series('Builds', strip(m.builds, buildTone))}
          {m.requests !== undefined && series('Requests', <Text color="claude">{spark(m.requests)}</Text>)}
          {(m.health?.reasons.length ?? 0) > 0 && <Text> </Text>}
          {(m.health?.reasons ?? []).map(r => (
            <Text dimColor>{cap(r, inner)}</Text>
          ))}
          {m.detailNote !== undefined && <Text dimColor>{cap(m.detailNote, inner * 2)}</Text>}
        </Box>,
      )
    }

    const prCard = (m: Match, repo: RepoView, many: boolean) =>
      card(
        `Pull requests${m.prs === undefined ? '' : ` (${m.prs.length})`}${many ? ` · ${m.name}` : ''}`,
        'inactive',
        <Box flexDirection="column">
          {m.prs === undefined && <Text dimColor>None collected yet</Text>}
          {m.prs !== undefined && m.prs.length === 0 && <Text dimColor>No open pull requests</Text>}
          {(m.prs ?? []).slice(0, 6).map(pr => {
            const failing = pr.build === 'failure' || pr.build === 'error'
            const author = cap(pr.author, 12)
            const room = Math.max(8, inner - 4 - pr.number.length - author.length - 2)

            return (
              <Box flexDirection="row" justifyContent="space-between">
                <Box flexDirection="row">
                  <Text color={pr.build === 'success' ? 'success' : failing ? 'error' : 'inactive'}>{pr.build === 'success' ? '✓' : failing ? '✗' : '·'} </Text>
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

    const releaseCard = (m: Match, repo: RepoView, many: boolean) => {
      const open = m.releases ?? []
      const choices = m.environments.map(env => ({ env, block: releaseBlock(env, repo.branch) }))

      return card(
        `Releases${many ? ` · ${m.name}` : ''}`,
        'inactive',
        <Box flexDirection="column">
          {open.length === 0 && <Text dimColor>No open releases</Text>}
          {open.map(r => (
            <Text>{cap(`${r.environment ?? 'environment'} · ${r.status}${r.target === undefined ? '' : ` · ${r.target}`}`, inner)}</Text>
          ))}
          <Text> </Text>
          <Text bold>Open a draft release</Text>
          {m.environments.length === 0 && <Text dimColor>No environments set up</Text>}
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
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
          </Box>
          {choices
            .filter(c => c.block !== undefined)
            .map(({ env, block }) => (
              <Text dimColor>{cap(`${env.name}: ${env.isProduction ? 'in the portal' : block}`, inner)}</Text>
            ))}
        </Box>,
      )
    }

    const shown = active === undefined ? [] : active.matches.slice(0, MAX_MATCHES)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>PlatformNEX</Text>
          <Box flexDirection="row">
            <Text dimColor>{matched} of {d.repos.length} repos · {ago(d.at, now)} </Text>
            <Button key="refresh" plain onPress={act(() => refresh($, cfg, true))}>
              ⟳
            </Button>
          </Box>
        </Box>
        <Text dimColor>{'─'.repeat(Math.max(10, columns))}</Text>
        {d.status === 'error' && d.error !== undefined && <Text color="error">{cap(d.error, columns * 2)}</Text>}
        {active !== undefined && <Text dimColor>{cap(`${active.name}${active.branch === undefined ? '' : ` · ${active.branch}`}`, columns)}</Text>}
        <Text> </Text>

        {u.notice !== undefined &&
          card(
            'Release',
            u.notice.text.startsWith('Could not') ? 'error' : 'success',
            <Box flexDirection="column">
              <Text>{cap(u.notice.text, inner * 2)}</Text>
              {u.notice.url !== undefined && <Link href={u.notice.url}>Open in the portal</Link>}
            </Box>,
          )}

        {u.pending !== undefined &&
          card(
            'Open a draft release?',
            'warning',
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

        {active === undefined && d.repos.length === 0 && <Text dimColor>No git repository found here.</Text>}
        {active !== undefined && active.lookup === 'none' && <Text dimColor>Not in the PlatformNEX catalog, or not visible to you.</Text>}
        {active !== undefined && active.lookup === 'error' && <Text color="error">Could not look this repository up.</Text>}
        {shown.map(m => (
          <Box flexDirection="column">
            {componentCard(m)}
            {prCard(m, active!, shown.length > 1)}
            {releaseCard(m, active!, shown.length > 1)}
          </Box>
        ))}
        {active !== undefined && active.matches.length > MAX_MATCHES && <Text dimColor>+{active.matches.length - MAX_MATCHES} more components in this repository</Text>}

        {others.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Other repos here</Text>
            {others.slice(0, 15).map(r => (
              <Button key={`pick-${r.root}`} plain onPress={act(async () => { await update($, ui, x => ({ ...x, chosenRoot: r.root, pending: undefined, notice: undefined })); await refresh($, cfg, true) })}>
                {cap(`  ${r.matches[0]?.name ?? r.name}${r.matches.length > 1 ? ` +${r.matches.length - 1}` : ''}`, columns)}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
