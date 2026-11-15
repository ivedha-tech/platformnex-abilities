# Business continuity and backup policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 A1.2, A1.3 · ISO 27001 A.5.29, A.5.30, A.8.13, A.8.14

## Targets (set per product in its PRD; these are defaults)

| Tier | Example | RTO | RPO |
|---|---|---|---|
| 1 | Customer-facing intake, hotline | 4 hours | 15 minutes |
| 2 | Internal tools | 1 working day | 24 hours |

## Rules

1. Datastores holding customer data have automated backups with point-in-time
   recovery where the service supports it, stored in the approved region.
2. Backups are encrypted and access to them is as restricted as the source.
3. A restore is tested every quarter per tier-1 datastore, and the result is
   recorded in a `restore-test` issue. An untested backup is not a backup.
4. Infrastructure can be rebuilt from Terraform; the state bucket is versioned.
5. Source code lives in GitHub and every engineer's clone; the handbook repo
   holds the runbooks.
6. Key-person risk: at least two people can perform every platform-admin task.
