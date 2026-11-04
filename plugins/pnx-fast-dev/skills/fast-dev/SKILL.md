---
name: fast-dev
description: Run or debug a service locally against a real non-production environment (dit1) with PlatformNEX's pnx CLI, without a build or deploy; preview a pull request at its own URL; or open, tunnel to or dump a component's database. Use when the user wants to try a change against dit1, see their local frontend or backend on the real dit1 URL, get an environment's settings and secrets locally, preview a pull request, reach a dit database (psql, a GUI, a dump), or asks about "pnx", "fast development", "intercept", "connect", "preview" or "pnx dev db".
---

# Fast development with pnx

`pnx` runs the user's app on their machine against a real non-production environment. **Nothing it does deploys**; production is refused. It is installed and kept up to date by this Ability (log: `~/.config/pnx/install.log`).

## Choose the command

Run these **in the component's own repository folder** (they read its `package.json`).

| The user wants | Command |
|---|---|
| Their requests on the real environment URL to reach their local app (frontend or backend), everyone else unaffected | `pnx dev intercept <component> --env <env>` |
| Their local app to call the environment's real services (tunnels, settings, secrets in memory) | `pnx dev connect <component> --env <env> -- <command>` |
| A `.env` with the environment's settings **and secrets** for an IDE or another tool | `pnx dev env <component> --env <env>` (0600, git-ignored; `pnx dev env --clean` deletes it) |
| Their pull request running on the environment at its own URL, with its own copy of the data (the link is also posted on the PR) | `pnx dev preview <component> --env <env>` (`--pr <n>`, else the open PR of this branch; `update` rebuilds, `--reset-data` re-copies, `stop` removes it) |
| A SQL console on the component's database | `pnx dev db <component> --env <env>` (psql; `--database <name>` when it has several) |
| Their database GUI (DBeaver, TablePlus, DataGrip) on it | `pnx dev db <component> --env <env> --tunnel` (prints host, port, user; no password, SSL off; Ctrl-C closes it) |
| A dump of the database | `pnx dev db <component> --env <env> --dump <file>.sql` |
| Which databases a component uses | `pnx dev db <component> --list` |
| See or end sessions | `pnx dev status`, `pnx dev stop`, `pnx dev extend` |
| Check or fix the machine | `pnx dev doctor`, `pnx dev doctor --fix` |

`<component>` is the PlatformNEX component name (for example `forcenex-backend`), `<env>` usually `dit1`.

## Intercept

`pnx dev intercept` does everything: starts a session, opens tunnels, loads settings and secrets, downloads Telepresence if missing, installs dependencies if `node_modules` is missing, runs the repository's `dev` script, and routes only requests carrying the header `x-pnx-dev: <the user's slug>` to it. It prints the slug. It asks for the user's password once (Telepresence's network daemon): tell the user to type it in their terminal; never try to supply it.

To see the result, the user adds that header in their browser (an extension such as ModHeader) for the environment's host, or uses `curl -H 'x-pnx-dev: <slug>' https://<host>/…`. Without the header they see the environment as usual. Ctrl-C ends the intercept and the session.

## Databases

`pnx dev db` reaches the database through the component's own pod and signs in as the workload's Google identity, so the user reads and writes exactly what the app can, with no password. It needs `psql`/`pg_dump` for the console and dump (`brew install libpq`); without psql it keeps the tunnel open instead. Run `--tunnel` in the background and give the user the connection settings it prints. A dump holds real data: say where it was written and don't open or print its contents unless asked.

If it says no database is registered, a tech lead runs "Discover databases" on the System's Resources page in PlatformNEX.

## Previews

`pnx dev preview` waits and prints the URL when ready (`--no-wait` returns at once). A preview never deploys and ends after a day or when the pull request closes. `PREVIEWS_NOT_ALLOWED` means an admin hasn't allowed previews on that database yet (its page in PlatformNEX has "Allow previews").

## When something fails

- `Not signed in`: `pnx login --catalog-url https://<portal host>/api/catalog` with a personal API key from the portal's Account › API keys. Never print or repeat an API key.
- `You already have a session …`: run the `pnx dev stop <id>` it names, then retry.
- `Which port does your app listen on locally?`: add `--port <port>`.
- Anything about gcloud, kubectl or Telepresence: `pnx dev doctor --fix`.
- `DEV_FEATURE_OFF`, or the environment refuses: fast development isn't on there; an admin turns it on in PlatformNEX › Administration › Environments.

A session never changes the environment for anyone else, and never deploys: releases still go through PlatformNEX's Release flow.
