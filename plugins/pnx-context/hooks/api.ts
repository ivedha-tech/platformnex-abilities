// The only place that talks to PlatformNEX. It sends the key to one host (the configured base)
// and never puts a URL, the key, a token or a response body into an error.
import type { EngineInterface } from 'claude-code'

import { cap, unwrap } from './lib'

export type Cfg = { base: string; key: string }

/** A failure that is safe to show: a short reason, nothing from the request or the response. */
export class ApiFailure extends Error {
  constructor(
    readonly reason: string,
    readonly status?: number,
  ) {
    super(reason)
  }
}

const AGENT = 'pnx-context-mod/0.1.0'
const TIMEOUT_MS = 12_000
const MAX_BODY = 2_000_000

let token: { value: string; expiresAt: number } | undefined

const reasonFor = (status: number): string =>
  status === 401 ? 'the API key was not accepted' : status === 403 ? 'not allowed' : status === 404 ? 'not found' : status === 429 ? 'rate limited, try again later' : `server answered ${status}`

type Reply = { status: number; ok: boolean; text: string }

async function send($: EngineInterface, cfg: Cfg, method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<Reply> {
  const request = $.http.fetch(`${cfg.base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'User-Agent': AGENT,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const timeout = $.clock.sleep(TIMEOUT_MS).then(() => {
    throw new ApiFailure('no answer in time')
  })
  // If the request wins the race, the timer's rejection must not surface later as an unhandled one.
  timeout.catch(() => undefined)
  let reply: Awaited<typeof request>
  try {
    reply = await Promise.race([request, timeout])
  } catch (error) {
    throw error instanceof ApiFailure ? error : new ApiFailure('could not reach PlatformNEX')
  }
  if (reply.text.length > MAX_BODY) throw new ApiFailure('answer too large')

  return { status: reply.status, ok: reply.ok, text: reply.text }
}

/** Trades the personal key for a 15-minute token, kept in memory only. */
async function bearer($: EngineInterface, cfg: Cfg): Promise<string> {
  if (token !== undefined && token.expiresAt - Date.now() > 60_000) return token.value
  const reply = await send($, cfg, 'POST', '/api/catalog/auth/api-key-token', { Authorization: `ApiKey ${cfg.key}` })
  if (!reply.ok) throw new ApiFailure(reasonFor(reply.status), reply.status)
  const data = unwrap(reply.text) as { accessToken?: unknown; expiresIn?: unknown } | undefined
  if (typeof data?.accessToken !== 'string' || data.accessToken === '') throw new ApiFailure('sign-in answer not understood')
  const seconds = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 900
  token = { value: data.accessToken, expiresAt: Date.now() + seconds * 1000 }

  return token.value
}

export const forgetToken = (): void => {
  token = undefined
}

/** One authenticated call; a 401 gets one fresh token and one retry. Returns the parsed envelope data. */
export async function call($: EngineInterface, cfg: Cfg, method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await send($, cfg, method, path, { Authorization: `Bearer ${await bearer($, cfg)}` }, body)
    if (reply.status === 401 && attempt === 0) {
      forgetToken()
      continue
    }
    if (!reply.ok) {
      const message = ((): string | undefined => {
        try {
          const parsed = JSON.parse(reply.text) as { error?: { message?: unknown } }

          return typeof parsed.error?.message === 'string' ? cap(parsed.error.message, 120) : undefined
        } catch {
          return undefined
        }
      })()
      throw new ApiFailure(message ?? reasonFor(reply.status), reply.status)
    }

    return { status: reply.status, data: unwrap(reply.text) }
  }

  throw new ApiFailure('the API key was not accepted', 401)
}

export function byRepo($: EngineInterface, cfg: Cfg, repoUrl: string) {
  return call($, cfg, 'GET', `/api/catalog/catalog/entities/by-repo?repoUrl=${encodeURIComponent(repoUrl)}`)
}

export function systemHealth($: EngineInterface, cfg: Cfg, namespaceAndName: string) {
  return call($, cfg, 'GET', `/api/catalog/systems/${namespaceAndName.split('/').map(encodeURIComponent).join('/')}/health?historyDays=14`)
}

/** Cached read-only snapshots, many in one request. Never the refresh route: that one re-runs billed jobs. */
export function snapshots($: EngineInterface, cfg: Cfg, keys: { domain: string; resourceType: string; resourceKey: string }[]) {
  return call($, cfg, 'POST', '/api/aggregator/dashboard/batch', { keys })
}

export function openReleases($: EngineInterface, cfg: Cfg, entityRef: string) {
  return call($, cfg, 'GET', `/api/catalog/releases?entityRef=${encodeURIComponent(entityRef)}&open=true&limit=5`)
}

/** Opens a DRAFT release session. This is the only write the mod makes; it never calls deploy. */
export function createDraftRelease($: EngineInterface, cfg: Cfg, body: { entityRef: string; environmentId: number; targetKind: 'branch'; targetRef: string }) {
  return call($, cfg, 'POST', '/api/catalog/releases', body)
}
