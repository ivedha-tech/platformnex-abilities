# Policies

Nine short policies. Each one says what must be true, and points at the
mechanism in the harness that makes it true. A policy with no mechanism is
marked **(manual)**, and those are the ones auditors will sample.

| Policy | Covers |
|---|---|
| [Information security](information-security-policy.md) | Top-level commitments, roles, exceptions |
| [Access control](access-control-policy.md) | Identity, least privilege, reviews, offboarding |
| [Secure SDLC and change management](secure-sdlc-and-change-management.md) | How code and infrastructure change |
| [Data classification and residency](data-classification-and-residency.md) | Data classes, handling, region, retention, privacy |
| [AI acceptable use](ai-acceptable-use-policy.md) | Approved tools, data rules, accountability |
| [Incident response](incident-response-policy.md) | Severity, roles, notification, postmortems |
| [Vendor and third-party](vendor-and-third-party-policy.md) | Onboarding, review, sub-processors |
| [Business continuity and backup](business-continuity-and-backup.md) | RTO/RPO, backups, restore tests |
| [Risk management](risk-management.md) | Risk register, scoring, treatment |

## How policies change

A policy changes by pull request to the handbook repo. `CODEOWNERS` requires
approval from the policy approver, so the merged PR is the approval record.
Each policy is reviewed at least every 12 months; the review is a PR even when
nothing changes (bump the dates).

## Exceptions

Open an issue with label `policy-exception` stating the policy, the reason, the
compensating control, and an expiry date of at most 90 days. The security lead
approves in the issue. Expired exceptions are closed or renewed, never left open.

These documents are a starting draft and not legal advice. Have counsel review
the privacy and breach-notification sections for your jurisdictions.
