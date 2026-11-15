# Vendor and third-party policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC9.2 · ISO 27001 A.5.19 to A.5.23

## Rules

1. A vendor that will store, process, or access Internal-or-higher data is
   assessed before use: what data, which region, security attestations
   (SOC 2 / ISO 27001 report), sub-processors, retention and deletion, breach
   notification terms, and whether inputs are used to train models.
2. Approval by the security lead, recorded in `compliance/vendor-register.csv`.
3. A data processing agreement is in place before personal data is shared.
4. Vendors are tiered: **critical** (holds Confidential/Restricted data or is in
   the production path) reviewed annually; others every two years.
5. Open-source dependencies are covered by the SDLC policy, not this one, but
   new runtime dependencies are named in the PR description.
6. Offboarding a vendor includes confirming data deletion and revoking access.
