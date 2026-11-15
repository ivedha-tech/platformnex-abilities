# Engineering Harness

One kit that takes a product from idea to production with the same gates for
humans and AI agents. Stack: **GitHub** (code, review) + **PlatformNEX** (build,
environments, release, operations; Cloud Build, GitOps and Argo CD underneath) +
**GCP** (runtime), built to produce SOC 2 and ISO 27001 evidence as a side
effect and to keep data inside one region.

> Status: starting point, not a certification. The policies need a named owner
> and management approval, and the Terraform has not been applied against a real
> organisation. See "What you must still decide" at the bottom.

## Where this lives

This folder is `engineering-harness/` in the `platformnex-abilities` repository, next to the plugins that deliver the agent layer (`plugins/pnx-harness` and the `harness-*` plugins). It is a kit to copy from, not a plugin: `scripts/bootstrap-github.sh` and `scripts/new-service.sh` assemble parts of it into the handbook, platform-infra and service repositories. CI for `platformnex-abilities` does not check this folder.

## What is in here

| Folder | What it is | Becomes |
|---|---|---|
| `docs/` | Operating model: lifecycle stages, gates, environments, AI rules, onboarding | Your engineering handbook repo |
| `policies/` | Nine org policies written to be short enough to be read | Same handbook repo, approved by management |
| `compliance/` | SOC 2 + ISO 27001:2022 control matrix, evidence plan, risk register | Auditor-facing evidence index |
| `templates/` | Idea brief, PRD, ADR, threat model, privacy assessment, release checklist, runbook, postmortem | Copied into each product repo |
| `github/` | Org settings checklist, rulesets, teams, labels, org-wide `.github` repo | Applied by `scripts/bootstrap-github.sh` |
| `repo-template/` | A working service repo: local dev, pre-commit, the PlatformNEX test build, agent brief and permission rules | A GitHub **template repository**, onboarded in PlatformNEX |
| `infra/bootstrap/` | Terraform: folders, projects, org policies (incl. data residency), audit logs, registry, build identities | Your `platform-infra` repo |
| `scripts/` | `doctor.sh`, `bootstrap-github.sh`, `bootstrap-gcp.sh`, `new-service.sh` | Run by the platform owner |

## The lifecycle in one picture

```
 IDEATE      DEFINE       DESIGN          BUILD            VERIFY           RELEASE              OPERATE
 idea brief  PRD          ADR             branch + PR      PlatformNEX      release session      SLOs, alerts
 (issue)     (docs/)      threat model    pre-commit       review + tests   dit -> qa/uat        runbook
                          privacy check   guard hooks      pnx preview      -> prod (approval)   postmortem
   G0          G1           G2               G3               G4               G5                   G6
 triage     PRD signed   design review   local checks    checks + 1-2      release checklist    review cadence
                                          pass            approvals        + prod approver
```

Every gate leaves an artefact in GitHub, PlatformNEX or GCP. That artefact is the audit
evidence, so nobody fills in a spreadsheet afterwards. Details:
`docs/01-operating-model.md`.

## Quickstart (platform owner, about half a day)

```bash
cp harness.config.env.example harness.config.env   # fill in org, billing, region
./scripts/doctor.sh                                # checks your local tools
./scripts/bootstrap-github.sh --dry-run            # prints what it would change
./scripts/bootstrap-github.sh                      # labels, teams, repos, rulesets
./scripts/bootstrap-gcp.sh                         # state bucket, then terraform plan
./scripts/new-service.sh my-first-service          # new repo from the template; then onboard it in PlatformNEX
```

Then work through `github/org-settings-checklist.md` (the settings GitHub only
exposes in the UI) and `docs/05-rollout-plan.md`.

## Quickstart (every team member, about 20 minutes)

Follow `docs/04-onboarding.md`. In short: clone, `make setup`, `make dev`,
and you have the same linters, secret scanning and agent rules as everyone
else. The agent skills and guard hooks arrive as organisation plugins
(`harness-*`, `pnx-harness`, `pnx-fast-dev`); see `docs/03-ai-agent-harness.md`.

## What you must still decide

1. **Region.** One harness instance pins one region (`REGION` in the config).
   Canadian and UK products each get their own folder and region.
2. **GitHub plan.** Org-level rulesets and required SSO need Team/Enterprise.
   The scripts fall back to per-repo rulesets.
3. **Policy owner and approver.** Fill the header table in each policy.
4. **Audit scope.** Which products are in scope for SOC 2 / ISO 27001 changes
   which rows in `compliance/control-matrix.csv` apply.
5. **Stack.** The sample service is Python on GKE through PlatformNEX. The gates
   do not care; swap the `Dockerfile`, `Makefile` targets and lint steps for your stack.
6. **Build provenance.** Earlier versions of this kit signed images and enforced
   Binary Authorization. PlatformNEX's generated build does not attest images, so
   that control is now "built only by platform triggers, deployed by digest
   through GitOps". Decide with the security lead whether that is enough.

## What has and has not been tested

Checked locally: every shell script parses and `new-service.sh` runs end to end
in `--dry-run`; `terraform validate` passes on `infra/bootstrap`; a service
rendered from the template passes `make setup` and `make check`; all YAML, JSON
and CSV files parse. The agent guard hooks live in the `pnx-harness` plugin and
have their own self-test there.

Not tested, because it needs your accounts: the scripts against a real GitHub
org and GCP org, `terraform plan`, the Docker build, onboarding a repository in
PlatformNEX, the test build under TestOps, and a release session. Treat the
first run of each as a commissioning step and expect small fixes. Pinned tool
versions (gitleaks, Trivy, ruff, pre-commit hooks) should be bumped to current.
