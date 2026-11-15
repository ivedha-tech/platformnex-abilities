# __SERVICE__

Created from the engineering harness service template. Built, released and
operated through PlatformNEX.

```bash
make setup              # venv, dependencies, git hooks
make dev                # run locally at http://localhost:8080/healthz
make dev-remote         # run locally against a real non-production environment (pnx)
make preview            # preview the open pull request at its own URL (pnx)
make check              # lint, tests, scans: what the test build checks
```

| Where | What |
|---|---|
| `CLAUDE.md`, `.claude/settings.json` | Agent brief and permission rules. Skills, agents and guard hooks come from the organisation's plugins (`harness-*`, `pnx-harness`, `pnx-fast-dev`) |
| `docs/` | PRDs (`specs/`), decisions (`adr/`), threat model, runbook, templates |
| `cloudbuild-tests.yaml` | Test-only build run by PlatformNEX TestOps: lint, tests, secrets, dependencies, config scan |
| `tests/specs/` | Acceptance criteria TestOps maps test results to |
| `scripts/check-gates.sh` | Fails a `feat:` branch that has no PRD (`PRD:` or `Skip-PRD:` trailers are the escape hatches) |
| `Dockerfile`, `cloudbuild.yaml` | Image build. `cloudbuild.yaml` is added by PlatformNEX when the repository is onboarded |

## First time

Onboard the repository in the PlatformNEX portal (Catalog › Onboard repository).
PlatformNEX opens a pull request adding `cloudbuild.yaml`, creates the build
trigger, the GitOps overlay and the runtime identity for each non-production
environment. Then, in Component › Setup › TestOps, bind the test trigger with
`testRoot: tests/` and `specDir: tests/specs`.

## Release flow

Merging to `main` builds the image and updates the non-production environment.
For later environments and production, open a release session in the portal
(component › Deliver › Release…). Production waits for a tech lead's approval.
Rollback and restart are options in the same dialog. Nothing is deployed from a laptop.

How we work, the gates, and the policies live in the engineering handbook.
