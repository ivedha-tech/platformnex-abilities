---
name: threat-model
description: Creates or updates docs/threat-model.md with a STRIDE pass over the current design (gate G2), and drafts the privacy impact assessment when personal data is involved. Use before building anything that adds an entry point, datastore or external service, or that handles Confidential or Restricted data.
---

# Threat model (gate G2)

## Overview

A threat model names concrete attacks against concrete components at each trust boundary, rates them, and proposes mitigations. A human reviewer signs it off; this skill never does.

## When to Use

- A new entry point: route, queue consumer, scheduled job, webhook
- A new datastore or external service
- Confidential or Restricted data, or any personal data
- An ADR changed a trust boundary

## Process

1. Read the template (the repository's `docs/templates/threat-model.md` if it exists, otherwise `template.md` in this skill's directory), the PRD, relevant ADRs, and the code's entry points.
2. Describe the system: actors, entry points, components, datastores, external services, trust boundaries and the region boundary. On PlatformNEX, include the namespace's network policy, the runtime service account and its roles, and which secrets the component mounts.
3. For each boundary, walk STRIDE and the prompts in the template. Name the component and the attack, not a category. harness-verify:security-and-hardening lists the controls to check against.
4. If any model sees user-controlled or fetched text, add prompt injection and data exfiltration through tool use as threats.
5. Rate likelihood and impact, propose a mitigation, and offer to open issues (label `security`) for mitigations that do not exist yet.
6. If the PRD says personal data is processed, draft the privacy impact assessment from `privacy-impact-assessment.md` in this skill's directory.
7. Say what you could not assess from the repository. Do not mark the review as signed off.

## Verification

- [ ] Every new entry point and data flow appears in the model
- [ ] Each threat names a component and an attack
- [ ] Each threat has likelihood, impact and a mitigation or an issue
- [ ] The document is not marked as signed off
