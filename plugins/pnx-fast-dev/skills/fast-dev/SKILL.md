---
name: fast-dev
description: Run or debug a service locally against a real non-production environment (dit1) with PlatformNEX's pnx CLI, without a build or deploy. Use when the user wants to try a change against dit1, see their local frontend or backend on the real dit1 URL, get an environment's settings and secrets locally, or asks about "pnx", "fast development", "intercept" or "connect".
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
| See or end sessions | `pnx dev status`, `pnx dev stop`, `pnx dev extend` |
| Check or fix the machine | `pnx dev doctor`, `pnx dev doctor --fix` |

`<component>` is the PlatformNEX component name (for example `forcenex-backend`), `<env>` usually `dit1`.

## Intercept

`pnx dev intercept` does everything: starts a session, opens tunnels, loads settings and secrets, downloads Telepresence if missing, installs dependencies if `node_modules` is missing, runs the repository's `dev` script, and routes only requests carrying the header `x-pnx-dev: <the user's slug>` to it. It prints the slug. It asks for the user's password once (Telepresence's network daemon): tell the user to type it in their terminal; never try to supply it.

To see the result, the user adds that header in their browser (an extension such as ModHeader) for the environment's host, or uses `curl -H 'x-pnx-dev: <slug>' https://<host>/…`. Without the header they see the environment as usual. Ctrl-C ends the intercept and the session.

## When something fails

- `Not signed in`: `pnx login --catalog-url https://<portal host>/api/catalog` with a personal API key from the portal's Account › API keys. Never print or repeat an API key.
- `You already have a session …`: run the `pnx dev stop <id>` it names, then retry.
- `Which port does your app listen on locally?`: add `--port <port>`.
- Anything about gcloud, kubectl or Telepresence: `pnx dev doctor --fix`.
- `DEV_FEATURE_OFF`, or the environment refuses: fast development isn't on there; an admin turns it on in PlatformNEX › Administration › Environments.

A session never changes the environment for anyone else, and never deploys: releases still go through PlatformNEX's Release flow.
