---
description: Define and enforce this project's quality bar - interview, sane defaults, CONSTRAINTS.md
disable-model-invocation: true
---

Invoke the harness-define:constraint-driven-development skill.

$ARGUMENTS

With no arguments, set up constraints for this repository:

1. **Detect first.** Read the manifest files (package.json, pyproject.toml, go.mod, and similar), the test runner, existing lint configs, current coverage output and CI workflows. Report what you found in two lines. Never ask for something you can read.

2. **Interview, at most four questions,** one at a time, each with your best guess and a usable default so "I don't know" still yields a working config:
   - Which dimensions beyond the floor (coverage, security, performance, accessibility, architecture)
   - Block or warn when a check fails mid-task
   - Target numbers, or measure today's values and hold them
   - The slowest check tolerated before handing work back

3. **Write CONSTRAINTS.md** at the repo root with a Floor section, enforced numbers, measured-only metrics with today's values, and an exceptions table with owners and expiry dates. Every number needs a stated reason.

4. **Install what each chosen dimension needs.** A dimension with a number and no tool behind it is an aspiration. Prefer the ecosystem's standard tool so existing config keeps working: a static analysis scanner for code, a secret scanner (always redacting output), a dependency vulnerability scanner, an automated accessibility checker, a web-vitals audit, a bundle-size budget, a dependency-boundary checker, a mutation tester for assertion quality. Record the exact command beside each rule in CONSTRAINTS.md. Accessibility and performance checks need a running URL; if there is none, say so and drop the dimension rather than inventing a check. Add the commands as fast, per-task and full check scripts.

5. **Place each check by cost.** Types, lint and secrets in the edit loop (seconds). Related tests and changed-line coverage at task end (under about 90 seconds). Everything else at review or in CI. Scope checks to the diff, not the whole repo.

6. **Point the agent at it.** Add a line to CLAUDE.md telling agents to read CONSTRAINTS.md and never weaken it to make a change pass.

7. **Verify.** Run the constraints on the current branch. If something fails that the user disagrees with, fix the constraint now rather than leaving a gate people will learn to ignore.

Sub-commands:
- `/constraints check`: run the constraints against this branch and report
- `/constraints guard`: inspect the diff for a weakened bar (lowered thresholds, skipped or deleted tests, new suppression comments, unfinished stubs, new exceptions)
- `/constraints ratchet`: record today's measured values as a floor that must not fall
