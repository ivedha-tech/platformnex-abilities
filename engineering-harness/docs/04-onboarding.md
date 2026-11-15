# Onboarding: your machine in 20 minutes

## Accounts (the platform owner does this for you)

- Google Workspace account with 2-step verification, added to `gcp-developers`.
- GitHub account in the org with 2FA, SSO linked, added to your team.
- Seat in the approved AI coding tool, under the company workspace. The
  organisation's plugins (`harness-*`, `pnx-harness`, `pnx-fast-dev`) arrive
  through managed settings; you do not install them.
- A PlatformNEX account with the developer role in your System, and a personal API key.

## Tools

Install: Git, Docker Desktop (or Colima / Podman), `gh`, `gcloud`, `make`,
Python 3.12+, Node 20+ (22 recommended), `pre-commit`, and Claude Code. The
`pnx` CLI installs itself the first time Claude Code starts with Node 20+. Or open the repo in the
dev container (`.devcontainer/`), which has all of these.

```bash
./scripts/doctor.sh        # from the harness repo; tells you what is missing
```

## One-time setup

```bash
gh auth login
gcloud auth login && gcloud auth application-default login
pnx login --catalog-url https://<portal host>/api/catalog   # paste your personal API key
pnx dev doctor --fix                                       # kubectl, GKE auth plugin, tunnel tool

# Signed commits (required by the ruleset). SSH signing is the simplest:
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
# then add the same key in GitHub > Settings > SSH and GPG keys > "Signing key"
```

## Per repo

```bash
gh repo clone <org>/<service> && cd <service>
make setup     # venv, dependencies, pre-commit hooks
make dev       # runs the service + local dependencies in Docker Compose
make dev-remote  # or: run it on your machine against dit1 (settings and secrets supplied by pnx)
make check     # the checks the test build runs
```

`make check` runs the same lint, tests and scans as the PlatformNEX test build (secret and
config scanners run locally only if you have gitleaks and trivy installed; CI
always runs them). If local and CI disagree,
that is a bug in the harness; open an issue with label `harness`.

## Your first change

1. Pick an issue, create `feat/<issue>-short-name`.
2. Make the change (with or without the agent).
3. `make check`, commit (hooks run), push, `gh pr create --fill` (or `/pr`).
4. `make preview` if you want reviewers to see it running.
5. Get the approval in PlatformNEX (the "PlatformNEX review" check), squash-merge,
   and watch it reach dit1 in the component's Deliver tab.
6. To move it on, open a release session: component › Deliver › Release….

## What you cannot do, by design

Push to `main`, merge your own PR without review, deploy or start a build from
your laptop, change a cluster with `kubectl`, approve your own production release,
create service account keys, create resources outside the approved region,
or read production data. If one of these blocks legitimate work, raise it with
the platform owner; do not work around it.
