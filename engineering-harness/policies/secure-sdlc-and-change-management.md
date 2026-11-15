# Secure SDLC and change management policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC7.1, CC8.1 · ISO 27001 A.8.25 to A.8.34, A.5.3, A.8.8, A.8.9

## Rules

1. All code, infrastructure, pipeline, and policy changes go through a pull
   request to a protected default branch. No direct pushes, no force pushes.
2. Every PR needs at least one approval from a code owner who is not the
   author; two for repos handling Confidential or Restricted data. The last
   push must be approved (new commits dismiss stale approvals).
3. Commits are signed. History is linear (squash merge).
4. Automated checks must pass before merge: lint, unit tests, secret scan,
   dependency vulnerability audit, infrastructure-as-code scan. Container images
   are scanned in the registry.
5. Design work that meets the "significant" bar has an ADR and a threat model
   before build starts.
6. Artefacts are built once by PlatformNEX build triggers, stored by digest, and
   promoted unchanged. Nobody builds or deploys from a laptop. What runs in an
   environment is what its GitOps repository says; Argo CD applies it.
7. Production releases are PlatformNEX release sessions and need approval from a
   tech lead who is not the author.
8. Infrastructure is defined in code and changed by pull request. Console or
   `kubectl` changes outside development are prohibited except under break-glass,
   and are back-ported to code within 2 working days.
9. AI agents read platform state only. Every platform change they suggest is a
   proposal that a person approves.
10. Emergency changes follow the fast path in the operating model and are
   reviewed retrospectively within one working day.

## Vulnerability handling

| Severity | Fix or mitigate within |
|---|---|
| Critical | 7 days |
| High | 30 days |
| Medium | 90 days |
| Low | Best effort |

Dependabot raises update PRs weekly. A vulnerability that cannot be fixed in
time needs a `policy-exception` issue with a compensating control.

## Environments

Environments are defined in PlatformNEX; production is marked as such and is
separated from non-production by project, namespace and identity. Production
data is not used outside production.
