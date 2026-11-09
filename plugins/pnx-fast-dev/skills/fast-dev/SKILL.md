---
name: fast-dev
description: Set up, install or run a PlatformNEX System or one of its components on this machine ("install speakupnex locally", "set up forcenex", "get forcenex-backend running locally", "run it locally"); run or debug a service locally against a real non-production environment (dit1) with PlatformNEX's pnx CLI, without a build or deploy; preview a pull request at its own URL; or open, tunnel to or dump a component's database. Use when the user wants to try a change against dit1, see their local frontend or backend on the real dit1 URL, get an environment's settings and secrets locally, preview a pull request, reach a dit database (psql, a GUI, a dump), or asks to install, set up, clone, get ready or run a System (any PlatformNEX System name, e.g. speakupnex, forcenex, servicenex) or one component locally, or asks to set up a System's components, clone its repositories, get it ready to run or run it locally, or asks about "pnx", "fast development", "intercept", "connect", "preview" or "pnx dev db".
---

# Fast development with pnx

`pnx` runs the user's app on their machine against a real non-production environment. **Nothing it does deploys**; production is refused. It is installed and kept up to date by this Ability (log: `~/.config/pnx/install.log`).

## Choose the command

**A whole System** ("install speakupnex locally", "set up forcenex", "get X ready to run locally", then "run locally"): use `pnx dev setup` and `pnx dev run`, from the folder where the user keeps their repositories (not inside a component's repository). **One component by name** ("install forcenex-backend locally", "get the speakupnex frontend running"): the name works on its own, no System needed: `pnx dev setup <component> --env dit1` (clone, install, `.env`) then `pnx dev run <component>`. `pnx dev up <component> --env dit1 --connect` is the one-step alternative that also runs it. Use the exact catalog name; a name that matches no System or component, or several, ask the user which. (A System's name and a component's can be the same: say `component:default/<name>` for the component.) **Single component already cloned:** run the commands below in that component's own repository folder (they read its `package.json`).

| The user wants | Command |
|---|---|
| A System's components on this machine: its folder, every repository cloned, dependencies installed, each `.env` written | `pnx dev setup <system or component> --env dit1` (`--only a,b` for some; safe to repeat) |
| Those components started, each connected to the environment | `pnx dev run <system>` (`--only a,b`; `--intercept` to intercept instead of connect; Ctrl-C stops all) |
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

## Setting up and running a System

When the user says "set up `<system>`'s components" (or similar): run `pnx dev setup <system> --env dit1` (use another `<env>` only if they name one). It creates `./<system>/`, clones every component's repository into it, installs dependencies, and writes each component's `.env` (with secrets, 0600, git-ignored). Tell them it clones with their own GitHub credentials. When it finishes, report which components are ready and read out any it flagged (no repository in the catalog, clone or install failed, secrets it couldn't read). Don't try to fix a flagged component by hand-cloning it unless they ask; a missing repository is fixed in PlatformNEX. Components of a monorepo share one clone and each sits in its own folder inside it; a component flagged as sharing a folder needs its folder (`spec.sourcePath`) set in PlatformNEX.

When they say "run locally" (or "start it"): run `pnx dev run <system>` **in the background** from the same folder as setup, then tell them which components started and on which ports (it prints them, labelled `[component]`). Output of every component is mixed in one stream; read it to answer questions about a specific one. Ctrl-C (or stopping the background task) ends all sessions. **Limit: at most 3 components at once** (the environment's per-person limit, 3 at most). If the System has more, don't start them all: ask which ones the user is working on (default: the ones they named, else the first three) and run `pnx dev run <system> --only a,b,c`. If `pnx dev run` still reports components it didn't start, tell the user which, and that they can run those with `--only` after stopping one, or an admin can raise “Per person”. Each component is its own session on the environment, so `You already have a session` or a per-person limit message for the second component means the environment's per-person limit is lower than the number of components: tell them an admin can raise it in Administration › Environments, or use `--only` to run fewer.

Components talk to the environment's services through tunnels (as with Connect), not to each other on localhost. To see a local frontend work against a local backend, use intercept on both (`--intercept`) or point the frontend at the backend's local port in its `.env`.

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
