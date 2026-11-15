# Risk management policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC3.1 to CC3.4 · ISO 27001 clauses 6.1, 8.2, 8.3

## Method

Risks are kept in `compliance/risk-register.csv`. Score = likelihood (1 to 5)
x impact (1 to 5).

| Score | Level | Treatment |
|---|---|---|
| 15 to 25 | High | Treat now; leadership informed; cannot be accepted below leadership |
| 8 to 14 | Medium | Treatment plan with owner and date |
| 1 to 7 | Low | Accept and monitor |

Each risk has an owner, a treatment (mitigate, transfer, avoid, accept), and a
review date. New risks come from threat models, incidents, vendor reviews,
and anyone who spots one (label `risk`).

## Cadence

Quarterly review by the security lead and leadership, recorded as a PR that
updates the register. A full reassessment happens annually and after any
major change in product, architecture, or regulation.
