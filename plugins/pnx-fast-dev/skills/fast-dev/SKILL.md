---
name: fast-dev
description: Set up, install or run a PlatformNEX System or one of its components on this machine ("install speakupnex locally", "set up forcenex", "get forcenex-backend running locally", "run it locally"); run or debug a service locally against a real non-production environment (dit1) with PlatformNEX's pnx CLI, without a build or deploy; preview a pull request at its own URL; or open, tunnel to or dump a component's database. Use when the user wants to try a change against dit1, see their local frontend or backend on the real dit1 URL, get an environment's settings and secrets locally, preview a pull request, reach a dit database (psql, a GUI, a dump), or asks to install, set up, clone, get ready or run a System (any PlatformNEX System name, e.g. speakupnex, forcenex, servicenex) or one component locally, or asks to set up a System's components, clone its repositories, get it ready to run or run it locally, or asks about "pnx", "fast development", "intercept", "connect", "preview" or "pnx dev db".
---

# Fast development with pnx

`pnx` runs the user's app on their machine against a real non-production environment. **Nothing it does deploys**; production is refused. It is installed and kept up to date by this Ability (log: `~/.config/pnx/install.log`).

## Choose the command

**A whole System** ("install speakupnex locally", "set up forcenex", "get X ready to run locally", then "run locally"): use `pnx dev setup` and `pnx dev run`, from the folder where the user keeps their repositories (not inside a component's repository). **One component by name:** `pnx dev setup <component> --env dit1` works on its own (see the section below); `pnx dev up <component> --env dit1 --connect` is the one-step clone, install and run. **Single component already cloned:** run the commands below in that component's own repository folder (they read its `package.json`).

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

## Setting up and running a System or component

**"install / set up / run `<name>` locally"** (a System such as speakupnex or scalenex, or one component) is this skill's job. Use `pnx`; do **not** go looking through GitHub or the machine for some other installer or repository that happens to match the name (a `*-claude-agents` repo, an `install-local.sh`, an app repo). If `pnx` says it knows no System or component of that name, ask the user what they meant; never guess a neighbour.

**First, check pnx is new enough.** Run `pnx help | grep "pnx dev setup"`. No output (or `pnx` not found) means pnx is missing or too old for these commands. Check `node -v`: pnx needs Node 20 or later; on an older Node, tell the user and offer `nvm install 22 && nvm alias default 22` (it changes their default Node, so ask before running it). Then update pnx: `npm config set @platformnex:registry https://us-central1-npm.pkg.dev/ivedha-mgmt-env-nonprod/platformnex-npm/ && npx --yes google-artifactregistry-auth && npm i -g @platformnex/pnx@latest` (needs `gcloud auth application-default login` done once). Don't try to work around an old pnx with guessed `pnx dev up` calls.

**Never assume which components. Ask first, every time:**
1. Run `pnx dev setup <name> --env dit1 --list` (read-only, clones nothing). It prints the components with their repository and folder, and names any with no repository.
2. Show the user that list and ask which components they want: all, or named ones. A single component they named exactly needs no question, but still say what you're about to do.
3. Run `pnx dev setup <name> --env dit1 --only a,b` (omit `--only` only when they said all). It makes `./<name>/`, clones each repository (a monorepo once), installs dependencies, and writes each component's `.env` (settings and secrets, 0600, git-ignored). It clones with the user's own GitHub credentials. Run it from the folder where they keep their repositories, not inside a component's repository.
4. Report which components are ready, and read out anything it flagged: no repository in the catalog (fixed in PlatformNEX, don't hand-clone), a missing tool (`go`, `mvn`, `poetry`… say which and that setup can be run again), a clone or install failure, a monorepo folder clash (set `spec.sourcePath` in PlatformNEX).

**It is not only for Node.** Setup recognises Node, Python, Go, Rust, Java (Maven, Gradle), Ruby, PHP, .NET and compose projects and installs each the usual way. For a project it doesn't recognise it says so and installs nothing: look at the repository's README, tell the user what you'd run, and run it only once they agree.

**Running:** before `pnx dev run`, confirm which components to start (again, not assumed). Then `pnx dev run <name> --env dit1 --only a,b` **in the background** from the same folder, and tell the user which started and on which ports (labelled `[component]` in its output). If pnx says it can't tell how to start a component (no dev script, unfamiliar stack), find the start command from the repository's README or files, tell the user, and with their OK run `pnx dev run <component> -- <command>` for that one. Ctrl-C (or stopping the background task) ends all sessions.

**Limit: at most 3 components at once** (the per-person session limit, 3 at most). With more, ask which three, or which to run first. If `pnx dev run` still reports components it didn't start, say which, and that they can run those with `--only` after stopping one, or an admin can raise “Per person” in Administration › Environments.

Components reach the environment's services through tunnels (as with Connect), not each other on localhost. For a local frontend against a local backend, use `--intercept` on both, or point the frontend at the backend's local port in its `.env`.

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
