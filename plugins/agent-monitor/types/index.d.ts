export type AgentRow = {
  id: string
  type: string
  description: string
  /** What it is doing now: its latest progress summary, else the description. */
  label: string
  status: string
  startTime: number
  /** When this mod first saw it finished, so its elapsed time stops. */
  endedAt?: number
  tokenCount: number
  window?: number
  samples: number[]
}

export type Ram = {
  /** The Claude Code process alone, in MB. */
  selfMb?: number
  /** The Claude Code process and everything it started, in MB. */
  treeMb?: number
  usedMb?: number
  totalMb?: number
  /** The machine's used share, 0 to 100, oldest first. */
  samples: number[]
}

/** One agent the marketplace defines: `team` is its plugin, `name` its agent file. */
export type RosterEntry = {
  team: string
  name: string
}

export type Snapshot = {
  now: number
  agents: AgentRow[]
  /** Every agent available to spawn, so idle ones are listed too. */
  roster: RosterEntry[]
  main: { tokens?: number; window: number }
  ram: Ram
}

declare module 'claude-code' {
  interface PluginState {
    'agent-monitor': { snapshot: Shaped<Snapshot> }
  }
}
