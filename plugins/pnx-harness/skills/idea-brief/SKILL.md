---
name: idea-brief
description: Turns a rough idea or problem into a half-page idea brief (gate G0) ready to file as a GitHub issue. Use when someone describes a problem, request or opportunity that is not yet an issue, or asks for an idea brief.
---

# Idea brief (gate G0)

## Overview

Gate G0 asks one question: is this problem worth a spec? The brief states who has the problem, what it costs them and how big the work looks. It does not design the solution.

## When to Use

- A problem, request or opportunity has been described and no issue exists yet
- An "idea" arrives as a solution with no stated problem

Not for work that already has an accepted issue: go to `pnx-harness:prd`.

## Process

1. Use the repository's `docs/templates/idea-brief.md` if it exists; otherwise `template.md` in this skill's directory.
2. If the idea is still vague, shape it first with harness-define:idea-refine, then come back.
3. Fill every section from what the user said. Where you would be guessing (evidence, size, data class), ask up to three short questions first.
4. Push back when there is a solution and no problem: ask who has the problem and what it costs them.
5. Show the draft. When the user approves, offer `gh issue create --label stage:idea`; the user confirms the command.

Keep it to half a page.

## Verification

- [ ] Every template section is filled or marked as an open question
- [ ] The problem names who is affected and the cost to them
- [ ] Data class is stated, or flagged as unknown
- [ ] Nothing was filed without the user's confirmation
