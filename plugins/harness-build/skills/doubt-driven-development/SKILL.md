---
name: doubt-driven-development
description: Cross-examines non-trivial decisions with a fresh-context, adversarial reviewer before they stand. Use when stakes are high (auth, security logic, migrations, irreversible operations), when working in unfamiliar code, when stress-testing a plan, or whenever a confident answer is cheaper to challenge now than to debug later.
---

# Doubt-Driven Development

## Overview

A confident answer is not a correct one. Long sessions turn assumptions into "facts" without anyone noticing. This skill puts a fresh-context reviewer, whose job is to disprove rather than approve, in front of each non-trivial output while changing course is still cheap. It is an in-flight posture, not a verdict on a finished artifact; harness-verify:code-review-and-quality is the final gate and this is the earlier check.

## When to Use

A decision is non-trivial when any of these holds:

- It adds or changes branching logic
- It crosses a module or service boundary
- It asserts something the compiler cannot check (thread safety, idempotence, ordering, invariants)
- Its correctness depends on context a later reader cannot see
- It is irreversible (production deploy, data migration, public API change)

Apply it before an architectural choice under uncertainty, before committing non-trivial code, before claiming something non-obvious ("this is safe", "this scales"), and when working in code you do not fully understand.

Skip it for renames, formatting, file moves, following an unambiguous instruction, reading or summarizing code, one-line changes with obvious correctness, running tools, or when the user asked for speed. Doubting every keystroke ships nothing.

## Loading Constraint

Run this from the main session, where a fresh reviewer can be spawned. A subagent that applies it would be spawning another subagent, which should not happen. If you are already inside a subagent, tell the user doubt-driven review cannot run nested and let the main session handle it. Only as a last resort, self-question by restating ARTIFACT and CONTRACT as a new prompt with a hard break from your earlier reasoning, and label the result degraded, since you still carry your own context.

## Process

```
Doubt cycle:
- [ ] 1 CLAIM     state the claim and why it matters
- [ ] 2 EXTRACT   isolate artifact + contract, strip reasoning
- [ ] 3 DOUBT     adversarial fresh-context review
- [ ] 4 RECONCILE classify every finding against the artifact text
- [ ] 5 STOP      trivial findings, 3 cycles, or user override
```

### 1. CLAIM

Write the decision in two or three lines, plus why it matters ("The cache layer is thread-safe under the read-heavy workload in the spec; a race corrupts user data and is hard to catch in QA"). If you cannot say it compactly you have a vibe, not a decision.

### 2. EXTRACT

Give the reviewer the artifact and the contract, not the journey: the diff or function (not the file), or the proposal in 3 to 5 sentences with its constraints, or the assertion with its supposed evidence. Strip your reasoning, since handing over conclusions returns validation of them. Keep the evidence that cuts against you (a caller, guard or test that contradicts the claim). If the unit cannot be held in one read, such as a 500-line change, decompose it first.

### 3. DOUBT

The prompt must be adversarial. Framing decides the answer:

```
Adversarial review. Find what is wrong with this artifact.
Assume the author is overconfident. Look for: unstated assumptions,
unhandled edge cases, hidden coupling or shared state, ways the
contract could be violated, conventions it may break, failures under
unexpected input. Do NOT validate or summarize. Report issues, or say
explicitly that you found none after thorough examination.

ARTIFACT: <artifact>
CONTRACT: <contract>
```

Send ARTIFACT and CONTRACT only. Never send the CLAIM; it biases the reviewer toward agreement. If you use a reviewer role defined for balanced verdicts, paste the adversarial prompt verbatim so issues-only output overrides the default; if it cannot be overridden, use a generic subagent.

**Second opinion from a different model.** A different model family catches blind spots the author's model shares. In interactive sessions, after the first review and before reconciling, ask the user whether they want one: a model CLI they have installed, a manual review they paste elsewhere, or skip. Never skip silently, and never run an external tool without their go-ahead. If they choose a CLI, check it is installed and runs, confirm the exact invocation and credentials with them, send only the adversarial prompt, ARTIFACT and CONTRACT, and prefer a read-only mode so instructions hidden in the artifact cannot act on the workspace. Never splice the artifact into a shell-quoted argument; write the prompt to a file and feed it on stdin. Each run needs its own confirmation. If the tool fails, say so and offer alternatives. If the user skips, state "proceeding with single-model findings". In non-interactive contexts (CI, scheduled, autonomous loops) skip it and announce "cross-model skipped: non-interactive context".

### 4. RECONCILE

You remain the orchestrator. Re-read the artifact against each finding; rubber-stamping the reviewer is as bad as ignoring it. Classify in this precedence:

1. **Contract misread**: the contract was unclear. Fix it first and reclassify next cycle.
2. **Valid and actionable**: change the artifact and loop.
3. **Valid trade-off**: real, but fixing costs more than accepting; record it for the user.
4. **Noise**: wrong under context the reviewer lacked. Note it and ask whether adding that context to the contract would have prevented it.

A fresh reviewer can be wrong precisely because it is fresh.

### 5. STOP

Stop when a cycle yields only trivial or already-considered findings, after three cycles (then escalate to the user), or when the user says to ship. Three cycles with substantive findings still open says the artifact may not be ready. If three cycles seem too few because the artifact is big, decompose it; do not lift the bound.

## Related Skills

- harness-verify:code-review-and-quality: post-hoc verdict; use both.
- harness-build:source-driven-development: checks facts about frameworks against docs; this checks your reasoning about the artifact.
- harness-verify:test-driven-development: a failing test is a concrete disproof attempt and satisfies this step for behavioural claims.
- harness-verify:debugging-and-error-recovery: use it to localize any real failure mode the reviewer surfaces.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'm confident, skip it" | Certainty is where blind spots hide. |
| "A reviewer is expensive" | A wrong commit in production costs more; the check is bounded. |
| "It will just nitpick" | Only if unscoped. Ask for issues that would break the contract. |
| "I'll review at the end" | By then correcting course is expensive. |
| "I'd never ship if I doubted everything" | It applies to non-trivial decisions only. |
| "Two opinions beat one" | Not if the second has less context. Reconcile, do not defer. |
| "The reviewer disagreed so I was wrong" | Disagreement is information; re-read and classify. |
| "The user said yes once to the CLI" | Each invocation needs fresh confirmation. |

## Red Flags

- Spawning a reviewer for a rename or formatting change
- Taking reviewer output as authoritative without re-reading the artifact
- More than three cycles without escalating
- Prompting "is this good?" instead of "find issues"
- Skipping doubt under time pressure on a high-stakes decision
- Re-reviewing an unchanged artifact
- Doubt theater: two or more cycles with substantive findings and none classified actionable
- Passing the CLAIM, or withholding the contract
- Running an external tool unconfirmed, or silently falling back when it fails
- Silently skipping the second-opinion offer in an interactive cycle

## Verification

- [ ] Each non-trivial decision was stated as a CLAIM
- [ ] At least one fresh-context review per non-trivial artifact (a TDD failing test counts for behavioural claims)
- [ ] Reviewer received ARTIFACT and CONTRACT only, with an adversarial prompt
- [ ] Findings classified against the artifact text
- [ ] A stop condition was met
- [ ] Interactive: second opinion offered and the answer acknowledged; non-interactive: skip announced
- [ ] Any external tool run was checked, confirmed and authorized beforehand
