/**
 * Setup inside the pane: the person pastes their key there and picks the environment; the plugin checks the key,
 * saves it the way `claude plugin configure --values-stdin` does, and the key never reaches the chat, a file of
 * ours or the screen after Enter. Pure parts only: the engine side is in register.tsx.
 */

/** The PlatformNEX environments the pane offers, production first. */
export const ENVIRONMENTS = [
  { id: 'prod', label: 'Production', base: 'https://agentic-platformnex-portal.prod.ivedha.dev' },
  { id: 'dit1', label: 'dit1', base: 'https://agentic-platformnex-portal.dit1.ivedha.dev' },
] as const

export type EnvironmentId = (typeof ENVIRONMENTS)[number]['id']

/** Which offered environment an address is, or undefined for another one. */
export const environmentOf = (base: string | undefined): EnvironmentId | undefined => ENVIRONMENTS.find(e => e.base === base)?.id

export const baseOf = (id: EnvironmentId): string => ENVIRONMENTS.find(e => e.id === id)?.base ?? ENVIRONMENTS[0].base

/** The portal page where a person creates an API key. */
export const apiKeysUrl = (base: string): string => `${base}/account/api-keys`

/** The pnx_ key in what was pasted (a label or quotes around it are fine), or undefined. */
export function extractKey(pasted: string): string | undefined {
  return /pnx_[A-Za-z0-9_-]{8,}/.exec(pasted)?.[0]
}

/** What `claude plugin configure --values-stdin` reads: the key and the address, nothing else. */
export const configureInput = (key: string, base: string): string => JSON.stringify({ apiKey: key, baseUrl: base })

/** The plugin's id as `claude plugin configure` names it. */
export const PLUGIN_ID = 'pnx-context@platformnex-abilities'

/**
 * Run with `node -e`: prints the `claude` to start. On Windows Node can't start npm's claude.cmd without a shell, so
 * the real claude.exe is looked up (PATH, npm's package, the native installer); elsewhere plain `claude`.
 */
export const FIND_CLAUDE = [
  "const p=require('path'),f=require('fs');",
  "if(process.platform!=='win32'){process.stdout.write('claude')}else{",
  "const e=process.env,c=[...(e.PATH||e.Path||'').split(';').filter(Boolean).map(d=>p.join(d,'claude.exe'))];",
  "if(e.APPDATA)c.push(p.join(e.APPDATA,'npm','node_modules','@anthropic-ai','claude-code','bin','claude.exe'));",
  "if(e.USERPROFILE)c.push(p.join(e.USERPROFILE,'.local','bin','claude.exe'));",
  "process.stdout.write(c.find(x=>{try{return f.statSync(x).isFile()}catch{return false}})||'claude')}",
].join('')
