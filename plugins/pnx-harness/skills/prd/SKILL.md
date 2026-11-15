---
name: prd
description: Writes or updates a PRD (gate G1) in docs/specs/ from an accepted idea issue, including the mandatory data and compliance section. Use when asked for a PRD, product requirements or a gate G1 document for a feature on a PlatformNEX service.
---

# PRD (gate G1)

## Overview

The PRD is the organisation's gate G1 artefact: user-visible requirements with testable acceptance criteria, written non-goals, and a data and compliance section that later gates are checked against. The general `/spec` command writes a technical spec; this skill writes the PRD that product owner and tech lead approve.

## When to Use

- An idea issue has been accepted and needs requirements
- An existing PRD must change because scope, data class or region changed

Not for trivial changes; those skip gates G0 to G2.

## Process

1. Read the idea issue (`gh issue view <n>`) and the template: the repository's `docs/templates/prd.md` if it exists, otherwise `template.md` in this skill's directory.
2. Create `docs/specs/<slug>.md` on a `docs/<issue>-prd` branch.
3. Write requirements as user-visible behaviour with acceptance criteria that can be tested. Follow harness-define:spec-driven-development for how to surface assumptions and scope.
4. Fill the data and compliance section. It is mandatory. If the feature touches personal data, state that a privacy impact assessment is required at G2 and which region the data must stay in (see the repository's `CLAUDE.md`).
5. State the rollout: which PlatformNEX environments the feature passes through, and whether it ships behind a flag.
6. List open questions instead of inventing answers.
7. Stop after the draft. Product owner and tech lead approve through the pull request.

## Verification

- [ ] Every requirement has an acceptance criterion a test could check
- [ ] Non-goals are written down
- [ ] Data class, personal data, region, retention, vendors and AI use are all stated
- [ ] Open questions are listed, not answered by guesswork
