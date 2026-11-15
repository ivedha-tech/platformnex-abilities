---
description: A direct readiness question. The release-check skill should fire.
expected_outcome: A checklist report with verified, not verified and failed items.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Is billing-api ready to go to production? Walk me through the release checklist.
