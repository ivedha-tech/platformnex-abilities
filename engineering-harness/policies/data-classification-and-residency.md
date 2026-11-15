# Data classification and residency policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC6.1, CC6.7, C1, P-series · ISO 27001 A.5.12 to A.5.14, A.5.33, A.5.34, A.8.10 to A.8.12, A.8.24 · PIPEDA · UK GDPR / GDPR

## Classes

| Class | Examples | Storage | Sharing | In AI prompts |
|---|---|---|---|---|
| Public | Marketing site, open-source code | Anywhere | Anyone | Yes |
| Internal | Source code, designs, internal docs | Company systems | Staff, contractors under NDA | Yes, approved tools only |
| Confidential | Customer business data, contracts, architecture of security controls | Prod project, approved region | Need-to-know | No |
| Restricted | Personal data, whistleblower / fraud reports, identity documents, credentials, keys | Prod project, approved region, access logged | Named individuals | Never |

Every PRD states the highest class the feature touches. When unsure, classify up.

## Residency

1. Each product has one approved region, set in `harness.config.env` and
   enforced by the `gcp.resourceLocations` org policy on the product folder.
   Resources cannot be created elsewhere.
2. Confidential and Restricted data, including backups and logs containing
   it, stays in that region. This includes data sent to third parties: a vendor
   that would process it elsewhere is not approved for that product.
3. Global services (for example DNS, IAM metadata) may hold configuration but
   not customer data. Check a service's data location terms before adopting it.
4. Support and engineering access from outside the region is access, not
   transfer of storage, but still needs a lawful basis; ask the security lead.

## Handling

- Encryption in transit (TLS 1.2+) and at rest everywhere. Customer-managed keys
  (Cloud KMS, same region) for Restricted data.
- Logs must not contain Restricted data. Log identifiers, not contents.
- Retention is defined per dataset in the PRD and enforced with lifecycle rules.
  Default: delete Restricted data when the purpose ends or on verified request.
- Collect the minimum personal data the feature needs.

## Privacy

- A privacy impact assessment (`templates/privacy-impact-assessment.md`) is
  required at G2 for anything processing personal data.
- Data subject / access requests are logged as issues with label `privacy-request`
  and answered within the statutory period (30 days under PIPEDA; one month under UK GDPR).
- Sub-processors are listed in the vendor register.
- Breach notification obligations are in the incident response policy.
