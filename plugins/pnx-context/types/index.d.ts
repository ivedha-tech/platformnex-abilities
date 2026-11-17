export type Environment = { id: number; name: string; isProduction: boolean }

export type Health = {
  status: string
  computedAt?: string
  /** Up to three short reasons, already length-capped. */
  reasons: string[]
  /** One status word per day, oldest first. */
  history: string[]
}

export type PullRequest = {
  number: string
  title: string
  author: string
  url?: string
  sourceBranch?: string
  /** success | failure | pending | error | unknown */
  build?: string
}

export type Release = { id: string; status: string; environment?: string; target?: string }

export type Match = {
  entityRef: string
  name: string
  title?: string
  systemRefs: string[]
  environments: Environment[]
  health?: Health
  /** Latest builds' outcomes, oldest first: ok | bad | other. */
  builds?: string[]
  /** Request counts over the metrics window, oldest first. */
  requests?: number[]
  prs?: PullRequest[]
  releases?: Release[]
  /** When this match's detail was read, ms since the epoch. */
  detailAt?: number
  /** Why some detail is missing, short. */
  detailNote?: string
}

export type RepoView = {
  root: string
  /** The folder's own name. */
  name: string
  /** Remote with any login removed. */
  remote?: string
  branch?: string
  head?: string
  lookup: 'found' | 'none' | 'error'
  matches: Match[]
}

export type Data = {
  at: number
  status: 'unconfigured' | 'ok' | 'error'
  /** Short and free of URLs, keys and response text. */
  error?: string
  repos: RepoView[]
}

export type Ui = {
  /** The repository the person chose; empty means follow the session. */
  chosenRoot?: string
  /** The repository the session's own tool calls touched last. */
  touchedRoot?: string
  /** The component tab the person picked, by entity ref; empty means the first. */
  activeEntity?: string
  /** A release draft waiting for the person's confirmation. */
  pending?: { entityRef: string; environmentId: number; environmentName: string; branch: string; head?: string }
  /** The result of the last action, one line plus an optional link. */
  notice?: { text: string; url?: string }
}

declare module 'claude-code' {
  interface PluginState {
    'pnx-context': { data: Shaped<Data>; ui: Shaped<Ui> }
  }
}
