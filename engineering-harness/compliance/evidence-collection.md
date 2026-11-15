# Evidence collection

Auditors ask three things of every control: is it designed sensibly, did it
operate for the whole period, and can you show it. The harness answers the
third by making normal work produce the record.

## Where evidence lives

| Source | What it proves | Retention to configure |
|---|---|---|
| GitHub PRs, reviews, check runs | Change management, segregation of duties, testing | Permanent (do not delete repos or branches-with-history in scope) |
| GitHub issues by label | Access requests/reviews, incidents, exceptions, restore tests, emergency changes | Permanent |
| GitHub audit log | Org setting changes, membership changes | Export or stream monthly; GitHub keeps a limited window depending on plan |
| GCP audit logs in the locked bucket | Who did what in the cloud, prod approvals, break-glass | 400 days minimum, retention-locked |
| PlatformNEX release sessions and Inbox approvals | What was released where and when, who requested, who approved, rollbacks | In PlatformNEX; export for the audit period |
| GitOps repository history | The exact configuration and image each environment ran | Permanent |
| Cloud Build history | Builds and test builds ran | In logs sink |
| Terraform repo | Configuration baseline and its change history | Permanent |
| Handbook repo | Policies, approvals, risk and vendor registers | Permanent |

## Labels that are evidence

`access-request`, `access-review`, `incident`, `emergency-change`,
`policy-exception`, `restore-test`, `privacy-request`, `ops-review`, `risk`,
`compliance`. Never delete these issues; close them with the outcome.

## Recurring tasks (create as scheduled issues)

| Cadence | Task | Label |
|---|---|---|
| Monthly | Ops review; export GitHub audit log | `ops-review` |
| Quarterly | Access review (GitHub teams, Google groups, IAM) | `access-review` |
| Quarterly | Risk register review | `risk` |
| Quarterly | Restore test per tier-1 datastore | `restore-test` |
| Annually | Policy review, vendor review, tabletop exercise, training refresher | `compliance` |

## Before the audit window starts

1. Every row in `control-matrix.csv` has an owner.
2. Each "No" in the `automated` column has a recurring issue.
3. Run one full cycle of each recurring task, so the first sample exists.
4. Type II needs the controls operating across the whole window (typically 3
   to 12 months). A control switched on halfway through is an exception.

## Honest limits

This matrix maps the controls the harness implements. It does not cover HR
controls (background checks, contracts), physical security, or a formal ISO
27001 Statement of Applicability, which you still need to produce.
