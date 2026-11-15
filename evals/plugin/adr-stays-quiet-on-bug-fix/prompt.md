---
description: A plain bug fix. The adr skill must not fire.
expected_outcome: A fix and a test; no architecture decision record.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

splitCents(100, 3) returns [33, 33, 33] and a cent goes missing. Fix it.
