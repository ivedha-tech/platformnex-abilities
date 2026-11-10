---
name: constraint-driven-development
description: Records a project's quality bar as a written, numeric, mechanically checkable contract (CONSTRAINTS.md) and watches diffs for quiet weakening of it, such as new lint or type suppressions, skipped or deleted tests, removed assertions, stubs, or lowered thresholds. Use when no quality bar is written down, when the user wants standards or gates defined, when coverage, performance, or accessibility targets need choosing, or when an agent keeps silencing checks to reach green.
---

# Constraint-Driven Development

## Overview

Review skills describe what good looks like, in prose that an agent may or may not follow and that vanishes when the session ends. This skill produces something different: a written record of this project's bar, with numbers, that outlives the conversation and can be checked by a machine.

The reason: when a person wrote the code, reading it was the quality check. An agent writes more in an afternoon than anyone reads in a week, so judgement has to move out of heads and into checks that run around the work loop. Those checks need numbers someone actually chose, and they need to fire close enough to the work that the agent fixes its own output.

Specs say what to build, tests show it works, constraints define "good enough to ship" before anyone argues about it in a review.

## When to Use

- A project or significant feature has no written quality bar
- The user asks for quality gates, standards, or protection against low-effort agent output
- Agents produce volume nobody reads line by line
- CI has checks but nobody can say which ones block a merge
- Coverage, performance, or accessibility numbers get re-argued per change
- An autonomous loop is about to run and the only gate is a test suite the agent also wrote

**When NOT to use:**

- A `CONSTRAINTS.md` already exists and is not being changed: read it and follow it
- Throwaway scripts, spikes, short-lived prototypes (the Floor is still cheap; the rest is not worth it)
- The user wants a review now (`harness-verify:code-review-and-quality`) or a pipeline built (`harness-ship:ci-cd-and-automation`)

**Needs a live user** for the interview. In unattended contexts, apply the Floor, say you did, and leave the rest for a human.

## The Process

### Step 1: Detect before asking

Never ask what you can read. Gather:

| What | Where |
|------|-------|
| Language and stack | manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`) |
| Test runner | dev dependencies, test script, existing tests |
| Linters | their config files |
| Coverage today | existing coverage output, or run the suite once |
| CI | the CI configuration directory or file |
| Agent instruction files | whichever the project uses |

Report findings in two lines, then ask only what remains.

### Step 2: Four questions, each with a default

Use the one-question-with-a-guess style of `harness-define:interview-me`. Every question has a default, so "I do not know" still yields a working config.

```
Q1: Beyond the Floor, which do you want enforced?
    (a) coverage on new code  (b) security scanning  (c) performance budgets
    (d) accessibility  (e) architecture boundaries
GUESS: (a) and (b); you have a test runner and handle user input.
DEFAULT: (a) and (b).
Say what each costs: (c) and (d) need a running URL; (e) needs a rules file.

Q2: When a check fails mid-task, block or warn?
GUESS: Block, because unattended agents ignore warnings.
DEFAULT: Block on the Floor, warn on the rest for two weeks.

Q3: Do you have target numbers, or should I measure today and hold that line?
GUESS: Measure; invented numbers get ignored.
DEFAULT: Measure and hold (see Ratchets).

Q4: What is the slowest check you will tolerate before work is handed back?
GUESS: about 90 seconds.
DEFAULT: 90 seconds at task end, unlimited in CI.
```

Stop at four. A long intake yields a config nobody understands.

### Step 3: Write CONSTRAINTS.md

One file at the repository root, readable by any agent and visible in review.

```markdown
# Constraints

Last reviewed: <date> by <owner>

## Floor (always enforced, no setup)

- No new suppression comments (type-ignore, lint-disable, noqa and similar)
- No unimplemented stubs: "not implemented" throws, empty catch blocks
- No skipped or deleted tests without a reason in the commit message
- No secrets in source
- This file is not weakened to make a change pass

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Types | zero errors | `tsc --noEmit` | every edit |
| Lint | zero errors | `biome check` | every edit |
| Secrets | none in source | `gitleaks dir . --redact` | every edit |
| Coverage | changed lines >= 80% | test runner + diff | task end, CI |
| Security: code | nothing high or above | `npm run check:security` | CI |
| Security: deps | nothing high or above | `osv-scanner scan source -r .` | CI |
| Accessibility | zero critical or serious | `npm run check:a11y` | preview deploy |
| Performance | LCP <= 2500 ms, CLS <= 0.1 | `lighthouse $PREVIEW_URL --output=json` | preview deploy |

Each row names the command that produces the verdict. A number with no command is an aspiration, not a constraint.

## Measured, not yet enforced

| Metric | Today | Direction |
|--------|-------|-----------|
| Project coverage | 62.4% | must not fall |
| Main bundle size | 184 kB | must not grow |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
| W1 | no-explicit-any | src/legacy/** | rewrite tracked in a ticket | name | date |
```

Finish by adding one line to the project's agent instructions file: read `CONSTRAINTS.md` before writing code, and never weaken it to make a change pass.

### Step 4: Install what each dimension needs

Choosing a dimension means installing something runnable. Do not leave a number with no mechanism, and do not hand-roll a checker where a widely used one exists; teams' existing configs keep working that way.

| Dimension | Tool | Gate on |
|-----------|------|---------|
| Types | `tsc` / `mypy` | any error |
| Lint | the project's existing linter | any error |
| Coverage | the test runner's coverage mode (`vitest`, `jest`, `pytest-cov`) | coverage of changed lines |
| Security: code | Semgrep (or a compatible fork) | high or critical, including legacy `ERROR` |
| Security: secrets | gitleaks | any finding |
| Security: dependencies | osv-scanner | high or above |
| Performance: page | Lighthouse | LCP, CLS, score |
| Performance: bundle | size-limit | per-entry byte budget |
| Accessibility | axe-core CLI | zero critical or serious |
| Architecture | dependency-cruiser | any violation |
| Assertion quality | Stryker (mutation testing) | mutation score |

Pitfalls:

1. **Redact secrets.** Run gitleaks with `--redact`. Otherwise the matched secret lands in the transcript, a log, or a commit message. Report the rule and location, never the value.
2. **URL-based tools need a running app.** Lighthouse and axe belong in a runtime stage against a preview or a local server. For a CLI or library with no URL, drop the dimension instead of faking a check.
3. **Scope expensive tools to the diff.** Mutation testing and Semgrep accept path lists; on changed files they take minutes, on the whole repo they get switched off.
4. **Do not run tests twice for coverage.** Read the coverage report your suite already writes and intersect it with the diff.
5. **Check licences** before redistributing third-party rule sets.

Scanners can exit 0 while reporting findings. `scripts/quality-gate.mjs` in this skill reads a Semgrep or axe JSON report, exits 1 on blocking severities, and exits 2 on an unreadable or incomplete report. Copy it into the project's `scripts/` directory and keep the scanner before `&&` so a failed scan stops the command.

Expose each check as a script so it runs without an agent:

```json
{
  "scripts": {
    "check:fast": "tsc --noEmit && eslint . && gitleaks dir . --redact --no-banner",
    "check:task": "npm run check:fast && vitest run --coverage",
    "check:security": "semgrep scan --config p/default --strict --json > semgrep-results.json && node scripts/quality-gate.mjs semgrep semgrep-results.json",
    "check:a11y": "axe \"$PREVIEW_URL\" --tags wcag2a,wcag2aa,wcag21aa --stdout > axe-results.json && node scripts/quality-gate.mjs axe axe-results.json",
    "check:full": "npm run check:task && npm run check:security && osv-scanner scan source -r ."
  }
}
```

`check:fast` runs after each edit, `check:task` when the agent believes it is done, `check:full` in CI. `check:a11y` needs `PREVIEW_URL` set and the preview reachable (POSIX shell syntax shown).

**Prove each gate.** Before calling a row enforced, run its real command against a deliberate violation and a clean control. The violation must fail, the control must pass, and a scanner error must fail. For severity thresholds, confirm that a below-threshold finding passes. Generating a report does not enforce a number.

Commands now live in two places: the `Checked by` column and the scripts. `CONSTRAINTS.md` is canonical because it carries the reasons and appears in review; scripts must mirror it, and when they drift the file wins.

### Step 5: Wire to the lifecycle

Running everything everywhere stalls the agent, the gate gets switched off, and a disabled gate is worse than none because the bar still appears to exist.

| Stage | What runs | Budget |
|-------|-----------|--------|
| Build | types, lint, secrets, the Floor | under 5 s, changed files only |
| Verify | related tests, coverage on changed lines | under 90 s |
| Review | everything, plus the guards in Step 6 | minutes |
| Ship | direction checks, no regressions | CI |

Scope checks to the diff (changed-line coverage is a number the agent can move; project coverage is one it inherited), and let cost decide placement: anything over a few seconds leaves the edit loop.

### Step 6: Guard the bar itself

If the agent writes both code and checks, the checks prove less than they seem to. Agents rarely invent clever loopholes; they hit red and take the cheapest road to green. Look for five moves in the diff at review time:

1. **The threshold moved:** a budget lowered, a severity dropped, a check pulled from the fast stage. Compare `CONSTRAINTS.md` with its state at the branch point.
2. **A test got easier:** a skip added, a test file deleted, assertions removed from a test that stayed.
3. **A checker was silenced:** new type-ignore or lint-disable comments. Four deserve extra attention because they disable something you rely on: coverage-ignore pragmas hide code from coverage, mutation-disable comments hide surviving mutants, and Semgrep or gitleaks allow-comments hide security findings.
4. **Work is unfinished:** a throwing stub, an empty catch that turns failure into silence, a TODO where the implementation belongs.
5. **An exception appeared:** a new Exceptions row nobody discussed.

Tightening the bar should be silent; loosening it should be loud. The Floor has no standard tool, so agents tend to write their own, each differently. `references/floor-guard.md` is a diff-scoped reference implementation (exit 0 clean, 1 violation, 2 could not run). Adapt it rather than reinventing it.

**Rank checks by circularity.** Ask: can the agent make this pass by writing code that does not work?

- **External:** accessibility rules, a vulnerability database, a real browser measurement. The agent cannot argue with them.
- **Project:** lint rules and layer boundaries owned by a human.
- **Suite:** the project's own tests; the most useful and the only really circular kind.

A bar made only of suite checks is worth less than one with an outside opinion. Make sure at least one external constraint is present.

### Step 7: Ratchets, when there is no number

Setting 80% coverage on a codebase at 62% gives a permanently red build and a team that learns to ignore red. Instead, record today's value with a direction in the "Measured, not yet enforced" table and refuse to get worse. When a number improves, update it; when it falls, that is the finding.

This also answers the training-incentive problem: passing tests is rewarded within seconds, while architectural decay shows up over months. A ratchet is the missing penalty, written where the build can see it.

## Sane Defaults

| Constraint | Default | Rationale |
|------------|---------|-----------|
| Coverage of changed lines | >= 80% | Forces a test; allows a config-only line |
| Project coverage | today's value, must not fall | Needs no debate to adopt |
| Mutation score (if used) | >= 60% to start | Realistic for a suite never mutated; 80% is mature |
| Dependency vulnerabilities | nothing high or above | Lower severities are mostly noise |
| LCP | <= 2500 ms | The common "good" web-vitals threshold |
| CLS | <= 0.1 | Same |
| Accessibility | zero critical or serious violations | Moderate and minor are often debatable |
| Exception lifetime | 90 days | Long enough to plan a fix, short enough to remember |
| Ratchet tolerance | 0.5% | Absorbs drift from unrelated files |

Always state the reason next to the number; an unexplained threshold gets deleted by the next person who hits it.

## Escalation Path

1. **Written only:** `CONSTRAINTS.md` exists and agents read it. Free; catches honest mistakes; relies on compliance.
2. **Scripted:** one `check` command running the fast checks, hooked into the agent workflow and CI. Deterministic, no new dependency.
3. **Tool-backed:** a dedicated runner handling diff scoping, budgets, ratchets, and guards. Use when you maintain more than about thirty lines of check-running shell. The floor guard reference is the starting point for the guard half.

Most projects stop at level 2. A first run can be Floor-only: the guard needs no installs, so protect the first commit immediately and add numbered dimensions as tools are installed. Machine-wide security tools can run in CI only; declare where each runs in the `Runs at` column.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "We will add constraints once the code settles" | Code settles around whatever was allowed while it moved. |
| "The tests are the constraints" | Tests you wrote prove you agree with yourself; they say nothing about dependency risk or bundle growth. |
| "We cannot hit 80% coverage" | Then do not set 80%. Hold today's number. |
| "It will slow the agent down" | Only if slow checks sit in the fast loop. That is a placement error. |
| "I will remember our standards" | The agent will not, and it writes most of the code. |
| "Constraints will block shipping" | An exception with an owner and a date unblocks you; deleting the constraint unblocks everyone forever. |

## Red Flags

- The interview ran past four questions or produced a config the user cannot explain
- A budget the codebase fails today, with no path to meet it
- A number in `CONSTRAINTS.md` with no tool behind it
- A hand-rolled checker where a standard one exists
- Every constraint is judged by the project's own tests
- `CONSTRAINTS.md` changed in the same commit as the feature that was failing
- An exception with no owner or an expiry over a year out
- The agent proposes relaxing a threshold rather than fixing the code
- Slow checks in the edit loop and people passing `--no-verify`
- Nobody has opened `CONSTRAINTS.md` since it was written

## Verification

- [ ] `CONSTRAINTS.md` exists and every number has a stated reason
- [ ] The Floor is enforced and passes on the current codebase unchanged
- [ ] Each chosen dimension has an installed tool and a command that runs today
- [ ] Each constraint says where it runs; the fast stage takes only seconds
- [ ] At least one constraint is external
- [ ] Measured-only metrics record today's value and a direction
- [ ] Exceptions have owners and expiry dates
- [ ] The project's agent instructions point at the file
- [ ] A trial run on the current branch shows no failures the user disagrees with
- [ ] Each enforced command fails on a deliberate violation and on a scanner error, passes a clean control, and respects the agreed severity threshold

## See Also

- `harness-define:interview-me`: the question discipline used in Step 2
- `harness-verify:code-review-and-quality`: how to review; this skill decides what review enforces
- `harness-ship:ci-cd-and-automation`: the pipeline these constraints run in
- `harness-verify:test-driven-development`: the suite coverage and mutation constraints measure
- `harness-verify:security-and-hardening`: what the security dimension should contain
- `harness-verify:performance-optimization`: where performance numbers come from
