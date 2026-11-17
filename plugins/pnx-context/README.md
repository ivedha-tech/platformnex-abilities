# pnx-context

A Claude Code mod that shows, beside your conversation, which PlatformNEX component the repo you are in belongs to: its health, open pull requests, open releases and small graphs. It can also open a **draft** release for a non-production environment. It never deploys.

## Set up (once per person)

You need a personal API key. It acts as you, so keep it private.

1. **Create the key** in the PlatformNEX portal: user menu, **API keys**. It starts with `pnx_`. Do not paste it into chat, an editor or a file.
2. **Save it.** In Claude Code run `/pnx-context setup`; it prints the exact command to copy. In your own terminal that is:

   ```bash
   read -rs K && printf '{"apiKey":"%s"}' "$K" | claude plugin configure pnx-context@platformnex-abilities --values-stdin; unset K
   ```

   `read -rs` waits for you to paste the key without showing it, so it stays out of your shell history. Or, inside Claude Code: `/plugin configure pnx-context@platformnex-abilities`.

   Running `claude plugin configure pnx-context@platformnex-abilities` on its own only **lists** the options; it does not set them.
3. **Restart Claude Code**, then run `/pnx-context check`.

The portal address has a default, so only the key is needed. To use another environment, add `"baseUrl": "https://..."` to the same JSON (https only, no path).

## Commands

| Command | Does |
| --- | --- |
| `/pnx-context` | open the pane |
| `/pnx-context refresh` | open it and read everything again now |
| `/pnx-context setup` | print the commands to save your key |
| `/pnx-context check` | test the address, the key and the lookup route, and say what to fix. It never shows the key |

In the pane (when it has focus): `1`, `2`, `3` switch component tabs, `r` refreshes, `a` to `h` pick a repo from the list, `p` and `n` turn its page, `x` dismisses an ASK answer, `m` shows it in full or short.

## Ask PlatformNEX from Claude Code

With the key saved, Claude gets two read-only tools. Ask in plain words and the answer is also drawn at the top of the pane (`ASK`), `x` dismisses it:

| You ask | Tool | The pane shows |
| --- | --- | --- |
| "create a change for me in speakupnex" | `pnx_plan_change` | a plan: **create a ticket in ServiceNEX first**, then draft the change, approval, a linked release, a check; the System's environments and approval gates |
| "what is my team working on" | `pnx_lens` (`lens_team_activity`, `lens_team_blocked`, ...) | the facts Lens returned and its view titles |

A plan is **a plan only**: nothing is created in PlatformNEX or ServiceNEX. The pane also draws the answer of any `platformnex` MCP tool you have configured yourself. It keeps the last five answers, cut down and capped, and never a key, token or the raw response.

Needs the gateway's `plan_propose` tool (platformnex-gateway PR #649) for plans, and the `lens` flag for Lens.

## If it shows an error

Run `/pnx-context check`. The usual causes:

- **the API key was not accepted**: the key is wrong, expired or revoked. Create a new one in the portal and save it again.
- **this PlatformNEX does not have the repo lookup yet**: the server you point at has not been updated. Ask the platform team, or set `baseUrl` to an environment that has it.
- **not allowed** / **not found**: your account cannot see that repository's component. This is not an error in the mod.

## What it calls

Everything is read-only except one draft release, and it uses only your own key. The two ask tools call the gateway's MCP proxy (`/api/catalog/mcp-proxy`), which offers read-only tools only, with a short token made from your key. See the pull request that added it for the full list. It never calls deploy, rollback, refresh or any live cost route.
