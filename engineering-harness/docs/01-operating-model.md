# Operating model: idea to production

The rule behind everything here: **a change reaches production only by passing
the same gates, whether a person or an AI agent wrote it**, and each gate
leaves a record where auditors can find it.

## Roles

| Role | Responsible for | Typical holder |
|---|---|---|
| Product owner | Idea triage, PRD sign-off, release go/no-go | Product lead |
| Tech lead | Design review, ADR approval, code owner of the repo | Senior engineer |
| Engineer | Build, test, review others' PRs | Everyone |
| Security lead | Threat model review, policy exceptions, incident commander | Named individual |
| Platform owner | GitHub org, GCP org, the PlatformNEX System and its settings, this harness | Named individual |
| Release approver | Approves production release sessions in PlatformNEX | Holds the tech lead role there; never the author |

A small team can have one person in several roles. The one rule that does not
bend: **the author of a change cannot be its only approver** (separation of
duties, SOC 2 CC8.1, ISO 27001 A.5.3).

## Stages and gates

| # | Stage | Input | Work | Gate (who) | Evidence left behind |
|---|---|---|---|---|---|
| G0 | Ideate | Problem, request, incident | `templates/idea-brief.md` filed as a GitHub issue with label `stage:idea` | Weekly triage: accept / park / reject (product owner) | Issue + decision comment |
| G1 | Define | Accepted idea | `templates/prd.md` in `docs/specs/` via PR; data classification filled in | PRD approved (product owner + tech lead) | Merged PR |
| G2 | Design | Approved PRD | ADR for each significant decision; `threat-model.md`; privacy assessment if personal data | Design review (tech lead + security lead when data is Confidential or higher) | Merged ADR / threat model PRs |
| G3 | Build | Approved design | Short-lived branch, small PRs, pre-commit hooks, agent guard hooks; `pnx` to run and preview against non-production | Local checks pass (automatic) | Signed commits |
| G4 | Verify | Open PR | PlatformNEX review and test build: lint, tests, secret scan, dependency audit, IaC scan; image scanning in the registry | All checks green + approval in PlatformNEX + code owner approval; all threads resolved | Check runs + review on the PR |
| G5 | Release | Merge to `main` | PlatformNEX builds once and updates non-production through GitOps and Argo CD; release sessions promote to qa/uat, then prod | `release-checklist.md` done; production release approved in PlatformNEX by a tech lead who is not the author | Release session record + approval, GitOps repository history |
| G6 | Operate | Running service | SLOs, alerts, runbook, on-call, postmortems, quarterly access review | Monthly ops review; postmortem within 5 working days of a Sev1/Sev2 | Postmortem PRs, access review issues |

### What counts as "significant" (needs an ADR)

New service or datastore, new external dependency or vendor, a change to
authentication/authorisation, anything that moves data across a trust or
region boundary, or anything expensive to reverse.

### Fast paths

- **Trivial change** (docs, copy, dependency patch bump): skip G0 to G2, still G3 to G5.
- **Emergency fix**: branch `hotfix/*`, one reviewer, all pull request checks still
  run, production approval in PlatformNEX still required, retrospective issue with label
  `emergency-change` opened within one working day. Nobody pushes to `main`
  directly; the ruleset has no bypass for humans.

## Working agreements

- Trunk-based: `main` is always releasable. Branches live under two days where possible.
- Branch names: `feat/<issue>-slug`, `fix/<issue>-slug`, `chore/...`, `hotfix/...`.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). Squash merge only.
- Every PR links an issue. PRs over about 400 changed lines get split.
- Definition of ready: PRD approved, acceptance criteria written, data classification known.
- Definition of done: merged, deployed to prod behind a flag or live, docs and runbook updated, alerts in place.
- Feature flags decouple deploy from release. Flags get an owner and a removal date.

## Cadence

| When | What | Output |
|---|---|---|
| Daily | Async standup in the team channel | Thread |
| Weekly | Idea triage + planning | Updated board |
| Per release | Release checklist | Checklist in the release PR / issue |
| Monthly | Ops review: SLOs, incidents, open vulnerabilities, cost | Issue with label `ops-review` |
| Quarterly | Access review, risk register review, restore test | Issues with label `compliance` |
| Annually | Policy review and re-approval, incident tabletop, vendor review | Signed-off PRs in the handbook |
