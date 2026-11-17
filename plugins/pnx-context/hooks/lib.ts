// Pure helpers: no engine calls, so they can be checked on their own.
import type { Environment, Health, PullRequest, Release } from '../types'

const BLOCKS = '▁▂▃▄▅▆▇█'

/** Short, one line, no control characters; anything shown from a server goes through this. */
export const cap = (text: unknown, max: number): string => {
  const one = String(text ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return one.length <= max ? one : `${one.slice(0, Math.max(0, max - 1))}…`
}

/** Removes any `user:token@` from a remote so a login never reaches the screen, state or the server. */
export const cleanRemote = (url: string): string =>
  url
    .trim()
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/i, '$1')

/** The spelling the gateway compares with: ssh form, `.git`, case and trailing slashes removed. */
export const normalizeRepoUrl = (url: string): string =>
  cleanRemote(url)
    .replace(/\/+$/, '')
    .toLowerCase()
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')

/** Whether this looks like `https://host/owner/name` or `git@host:owner/name`, which is all the gateway takes. */
export const isRepoUrl = (url: string): boolean => /^(https?:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+|git@[^:\s]+:[^/\s]+\/[^/\s]+)\/?$/i.test(url)

/** The key goes only to https, or to this machine while developing. */
export const safeBaseUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const url = value.trim().replace(/\/+$/, '')
  if (/^https:\/\/[^/\s?#@]+$/i.test(url)) return url
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) return url

  return undefined
}

export type ScannedRepo = { root: string; remote?: string; branch?: string; head?: string }

/** Reads the scan script's tab-separated lines: folder, remote, branch, short sha. */
export const parseScan = (stdout: string): ScannedRepo[] =>
  stdout
    .split('\n')
    .map(line => line.split('\t'))
    .filter(parts => parts.length >= 1 && (parts[0] ?? '').startsWith('/'))
    .map(([root = '', remote = '', branch = '', head = '']) => ({
      root,
      remote: remote.trim() === '' ? undefined : cleanRemote(remote),
      branch: branch.trim() === '' || branch.trim() === 'HEAD' ? undefined : branch.trim(),
      head: head.trim() === '' ? undefined : head.trim(),
    }))

/**
 * One entry for each distinct remote (a worktree repeats its repository); the shortest path wins,
 * except that the folder containing `cwd` always wins, so the worktree you are in is the one shown.
 */
export const dedupeByRemote = (repos: ScannedRepo[], cwd?: string): ScannedRepo[] => {
  const seen = new Map<string, ScannedRepo>()
  const holdsCwd = (repo: ScannedRepo) => cwd !== undefined && rootContaining(cwd, [repo.root]) !== undefined
  for (const repo of [...repos].sort((a, b) => Number(holdsCwd(b)) - Number(holdsCwd(a)) || a.root.length - b.root.length)) {
    const key = repo.remote === undefined ? `path:${repo.root}` : normalizeRepoUrl(repo.remote)
    if (!seen.has(key)) seen.set(key, repo)
  }

  return [...seen.values()]
}

/** The repository whose folder contains this path, the deepest one when they nest. */
export const rootContaining = (path: string, roots: string[]): string | undefined =>
  [...roots]
    .sort((a, b) => b.length - a.length)
    .find(root => path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`))

export const baseName = (path: string): string => path.replace(/\/+$/, '').split('/').pop() ?? path

/** `https://host/x` JSON with either envelope: `{success, data}` or the body itself. */
export const unwrap = (text: string): unknown => {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return undefined
  }
  if (body !== null && typeof body === 'object' && 'success' in body) {
    const wrapped = body as { success: unknown; data?: unknown }

    return wrapped.success === true ? wrapped.data : undefined
  }

  return body
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const str = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)

export const parseEnvironments = (value: unknown): Environment[] =>
  asArray(value).flatMap(raw => {
    const one = asRecord(raw)
    const id = Number(one?.['id'])

    return one !== undefined && Number.isInteger(id) && str(one['name']) !== undefined
      ? [{ id, name: cap(one['name'], 40), isProduction: one['isProduction'] === true }]
      : []
  })

export type ParsedMatch = {
  entityRef: string
  name: string
  title?: string
  systemRefs: string[]
  environments: Environment[]
}

export const parseByRepo = (data: unknown): ParsedMatch[] =>
  asArray(asRecord(data)?.['items']).flatMap(raw => {
    const one = asRecord(raw)
    const entityRef = str(one?.['entityRef'])
    const name = str(one?.['name'])
    if (one === undefined || entityRef === undefined || name === undefined) return []

    return [
      {
        entityRef,
        name: cap(name, 60),
        title: str(one['title']) === undefined ? undefined : cap(one['title'], 60),
        systemRefs: asArray(one['systemRefs']).filter((v): v is string => typeof v === 'string'),
        environments: parseEnvironments(one['environments']),
      },
    ]
  })

/** `system:default/scalenex` -> `default/scalenex`, else undefined. */
export const systemPath = (systemRef: string): string | undefined => {
  const hit = /^system:([^/\s]+)\/([^/\s]+)$/i.exec(systemRef)

  return hit === null ? undefined : `${hit[1]}/${hit[2]}`
}

const word = (status: unknown): string => (typeof status === 'string' && status !== '' ? status : 'unknown')

/** The component's own status when the System's health names it, else the System's. */
export const parseHealth = (data: unknown, entityRef: string): Health | undefined => {
  const root = asRecord(data)
  const current = asRecord(root?.['current'])
  if (current === undefined) return undefined

  const own = asArray(current['components'])
    .map(asRecord)
    .find(c => c?.['entityRef'] === entityRef)
  const reasons = asArray(current['reasons'])
    .map(r => (typeof r === 'string' ? r : str(asRecord(r)?.['message'])))
    .filter((r): r is string => r !== undefined)
    .slice(0, 3)
    .map(r => cap(r, 110))

  return {
    status: word(own?.['status'] ?? current['status']),
    computedAt: str(current['computed_at']),
    reasons,
    history: asArray(root?.['history']).map(h => word(asRecord(h)?.['status'])).slice(-14),
  }
}

/** An open pull request list from the cache payload, a plain array (or a paginated `{data}`). */
export const parsePrs = (payload: unknown): PullRequest[] => {
  const list = Array.isArray(payload) ? payload : asArray(asRecord(payload)?.['data'])

  return list.flatMap(raw => {
    const one = asRecord(raw)
    const number = one?.['id'] === undefined ? undefined : String(one['id'])
    if (one === undefined || number === undefined || (one['status'] !== undefined && one['status'] !== 'open')) return []

    return [
      {
        number: cap(number, 12),
        title: cap(one['title'], 80),
        author: cap(one['author'] ?? one['createdBy'], 30),
        url: safeHttpUrl(one['url']),
        sourceBranch: str(one['sourceBranch']) === undefined ? undefined : cap(one['sourceBranch'], 80),
        build: str(asRecord(one['buildStatus'])?.['state']),
      },
    ]
  })
}

export const safeHttpUrl = (value: unknown): string | undefined =>
  typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value) ? value : undefined

/** Build outcomes from the cached pipelines payload, oldest first: ok | bad | other. */
export const parseBuilds = (payload: unknown, limit = 20): string[] => {
  const list = asArray(asRecord(payload)?.['pipelines'] ?? payload)
    .map(asRecord)
    .filter((p): p is Record<string, unknown> => p !== undefined)
    .sort((a, b) => String(a['createTime'] ?? '').localeCompare(String(b['createTime'] ?? '')))

  return list.slice(-limit).map(p => {
    const status = String(p['status'] ?? '').toUpperCase()

    return status === 'SUCCESS' ? 'ok' : ['FAILURE', 'TIMEOUT', 'INTERNAL_ERROR'].includes(status) ? 'bad' : 'other'
  })
}

/** Request counts from a cached Cloud Monitoring payload, oldest first; any other shape is no series. */
export const parseSeries = (payload: unknown, limit = 36): number[] => {
  const points = asArray(asRecord(payload)?.['timeSeries'])
    .flatMap(series => asArray(asRecord(series)?.['points']))
    .map(asRecord)
    .flatMap(p => {
      const value = asRecord(p?.['value'])
      const n = Number(value?.['doubleValue'] ?? value?.['int64Value'])
      const at = str(asRecord(p?.['interval'])?.['endTime'])

      return Number.isFinite(n) && at !== undefined ? [{ at, n }] : []
    })
  // Several series (one per instance) are summed per timestamp.
  const byTime = new Map<string, number>()
  for (const p of points) byTime.set(p.at, (byTime.get(p.at) ?? 0) + p.n)

  return [...byTime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-limit)
    .map(([, n]) => n)
}

export const parseReleases = (data: unknown): Release[] =>
  asArray(asRecord(data)?.['items']).flatMap(raw => {
    const one = asRecord(raw)
    const id = str(one?.['id'])
    if (one === undefined || id === undefined) return []

    return [
      {
        id,
        status: cap(one['status'], 24),
        environment: str(one['environment_name']) === undefined ? undefined : cap(one['environment_name'], 30),
        target: str(one['target_ref']) === undefined ? undefined : cap(one['target_ref'], 40),
      },
    ]
  })

/** Eight-level bars for a series, scaled to its own range; empty for nothing. */
export const spark = (values: number[]): string => {
  if (values.length === 0) return ''
  const lo = Math.min(...values)
  const hi = Math.max(...values)

  return values.map(v => BLOCKS[Math.min(7, Math.max(0, Math.round(((v - lo) / (hi - lo || 1)) * 7)))]).join('')
}

export const healthTone = (status: string): 'success' | 'warning' | 'error' | 'inactive' =>
  status === 'healthy' ? 'success' : status === 'at_risk' || status === 'degraded' ? 'warning' : status === 'critical' ? 'error' : 'inactive'

export const healthLabel = (status: string): string => status.replace(/_/g, ' ')

export const buildTone = (outcome: string): 'success' | 'error' | 'inactive' => (outcome === 'ok' ? 'success' : outcome === 'bad' ? 'error' : 'inactive')

/** `3 min ago`, `2 h ago`, `1 d ago`; empty when the time is unknown. */
export const ago = (then: number | string | undefined, now: number): string => {
  const at = typeof then === 'string' ? Date.parse(then) : then
  if (at === undefined || Number.isNaN(at)) return ''
  const minutes = Math.max(0, Math.round((now - at) / 60_000))

  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`
}

/** Why a draft release cannot be started from here, or undefined when it can. */
export const releaseBlock = (env: Environment, branch: string | undefined): string | undefined =>
  env.isProduction
    ? 'production releases are opened in the portal'
    : branch === undefined
      ? 'no branch checked out (detached HEAD)'
      : undefined

/** `950`, `1.2k`, `3.4M`. */
export const compact = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

/** Share of finished builds that passed, as a whole percentage; undefined with none finished. */
export const passRate = (builds: string[]): number | undefined => {
  const ok = builds.filter(b => b === 'ok').length
  const bad = builds.filter(b => b === 'bad').length

  return ok + bad === 0 ? undefined : Math.round((ok / (ok + bad)) * 100)
}

/** How many of these days were not healthy (unknown days are not counted). */
export const daysAtRisk = (history: string[]): number => history.filter(s => s === 'at_risk' || s === 'degraded' || s === 'critical').length
