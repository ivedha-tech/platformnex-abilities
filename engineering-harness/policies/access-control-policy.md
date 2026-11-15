# Access control policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC6.1 to CC6.3 · ISO 27001 A.5.15 to A.5.18, A.8.2 to A.8.5

## Rules

1. **Single identity.** Google Workspace is the identity provider. GitHub and
   GCP are accessed through SSO. 2-step verification is mandatory, with a
   security key or passkey for admins.
2. **Groups, not people.** Permissions are granted to groups / teams in code
   (`infra/bootstrap`, `github/teams.yaml`). No individual IAM bindings.
3. **Least privilege by environment.**

   | Group | non-production (dit) | pre-production (qa, uat) | prod |
   |---|---|---|---|
   | developers | debug through `pnx` sessions; start releases | start releases; read-only otherwise | request a release; logs and metrics only |
   | tech leads (PlatformNEX role) | as developers | as developers; edit secrets | approve and deploy releases; edit secrets |
   | platform admins | admin | admin | admin via break-glass only |
   | security | read | read | read + audit logs |

4. **No long-lived credentials.** Service account keys are blocked by org
   policy. No personal access tokens with org-wide scope; use fine-grained
   tokens with an expiry of 90 days or less.
5. **Joiner / mover / leaver.** Access is requested by issue (`access-request`
   label) and approved by the manager. On departure, the Workspace account is
   suspended the same day, which removes GitHub and GCP access through SSO.
6. **Quarterly access review.** The platform owner exports group and team
   membership, the security lead confirms each member, and removals are done
   within 5 working days. The closed `access-review` issue is the evidence.
7. **Break-glass.** Time-bound, logged, reviewed afterwards
   (`docs/02-environments-and-release.md`).
8. **Secrets** live only in Secret Manager. Never in code, chat, tickets, or prompts.

## Mechanisms

Org policy `iam.disableServiceAccountKeyCreation`, `iam.allowedPolicyMemberDomains`;
GitHub required 2FA and SSO; rulesets; gitleaks in pre-commit and CI.
