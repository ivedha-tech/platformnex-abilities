---
name: code-review-and-quality
description: Runs a five-axis review (correctness, readability, architecture, security, performance) with severity-labelled findings, change-size limits and dependency-upgrade discipline. Use before merging any change, when reviewing a diff or pull request (including one pasted inline), or when assessing code written by yourself, another agent or a human.
---

# Code Review and Quality

## Overview

Every change is reviewed before it merges, with no exceptions. The review covers five axes: correctness, readability, architecture, security and performance.

**Approval standard:** approve when the change definitely improves overall code health, even if it is not how you would have written it. Perfect code does not exist; do not block on taste. If it improves the codebase and follows project conventions, approve.

## When to Use

- Before merging any change
- After finishing a feature or a bug fix (review the fix and its regression test)
- When evaluating code produced by another agent or model
- When refactoring

## The Five Axes

### 1. Correctness
- Does it match the spec or task?
- Edge cases (null, empty, boundaries) and error paths, not just the happy path?
- Do the tests exist, pass, and actually test the right thing?
- Off-by-one errors, races, inconsistent state?

### 2. Readability and simplicity
- Names descriptive and consistent with the project? No bare `temp`, `data`, `result`.
- Straightforward control flow (no nested ternaries or deep callbacks)?
- Clever tricks that should be plain code?
- Could it be much shorter? Do abstractions earn their complexity (do not generalize before the third use)?
- Dead artifacts: unused variables, compatibility shims, "removed" comments?
- Is a new conditional bolted onto an unrelated flow? That is a design smell, not a nit; give it its own helper, state or policy.
- Repeated conditionals on the same shape suggest a missing model or dispatcher. A "temporary" branch is usually permanent.

### 3. Architecture
- Follows existing patterns, or introduces a new one with justification?
- Clean module boundaries, dependencies flowing the right way, no cycles?
- Duplication that should be shared?
- Does a refactor reduce complexity or just relocate it? Count the concepts a reader must hold. If the count is unchanged, it is not cleaner. Prefer the restructuring that makes whole branches or layers disappear, and prefer deleting an abstraction to polishing it.
- Is feature-specific logic leaking into a shared module? Keep logic in its owning layer and reuse the canonical helper instead of a near-duplicate.
- Are type boundaries explicit? Question gratuitous `any`, casts and silent fallbacks that paper over an unclear invariant.

### 4. Security
Details: harness-verify:security-and-hardening.
- Input validated at boundaries; external data (APIs, logs, user content, config) treated as untrusted?
- No secrets in code, logs or version control?
- Authentication and authorization checks present?
- Queries parameterized; output encoded against XSS?
- Dependencies trustworthy and free of known vulnerabilities?

### 5. Performance
Details: harness-verify:performance-optimization.
- N+1 queries, unbounded loops or unconstrained fetches?
- Synchronous work that should be async?
- Needless UI re-renders, missing pagination, large objects in hot paths?

## Structural Remedies

When you flag a structural problem, propose the move. Options:

- Replace a conditional chain with a typed model or explicit dispatcher
- Collapse duplicate branches into one flow
- Separate orchestration from business logic
- Move feature logic out of a shared module into its owner
- Reuse the canonical helper instead of a near-duplicate
- Make a type boundary explicit so downstream branching vanishes
- Delete a pass-through wrapper that only adds indirection
- Extract a helper or split a large file

Prefer the remedy that removes moving parts over one that spreads them around.

## Change Sizing

```
~100 lines   good, reviewable in one sitting
~300 lines   acceptable if one logical change
~1000 lines  too large; split it
```

Watch file size too: a file near 1000 total lines is a common signal, not a hard cap. If a change grows an already-large file, consider extracting first, then adding.

"One change" is a single self-contained modification with its tests that leaves the system working. Splitting strategies: stack small sequential changes; split by file group when reviewers differ; horizontal (shared code first, consumers after); vertical (thin full-stack slices). Large changes are fine for pure deletions and automated refactors where the reviewer verifies intent. Keep refactoring and new behavior in separate changes; tiny renames may ride along at the reviewer's discretion.

## Change Descriptions

The first line is short, imperative and standalone ("Delete the legacy export endpoint"), informative enough for someone searching history. The body says what changed and why, with context, decisions, links to issues or benchmarks, and known shortcomings. Avoid "Fix bug", "Fix build", "Phase 1", "Moving code from A to B".

## Review Process

1. **Understand the context.** What is this for, what spec does it implement, what behavior changes?
2. **Review the tests first.** Do they exist, test behavior, cover edge cases, have clear names, and would they catch a regression? Answer the last one by experiment: invert a condition the change adds (drop a negation, swap `&&` for `||`), run the suite, then restore the file from a copy. A mutation that stays green is a finding; name the missing test case. For project-wide mutation scoring see harness-define:constraint-driven-development.
3. **Review the implementation** file by file against the five axes.
4. **Categorize findings.** Before reporting one, check it against the callers, guards and tests that reach the code, and drop it if they rule it out. Label defects already present in the base separately from regressions this change introduces. Zero findings is a valid result; do not invent any.
5. **Check the verification story.** Tests run, build status, manual checks, screenshots for UI, before/after data.

### Severity labels

| Prefix | Meaning | Author action |
|---|---|---|
| (none) | Required change | Address before merge |
| Critical: | Blocks merge (vulnerability, data loss, broken behavior) | Must fix |
| Nit: | Minor, optional | May ignore |
| Optional: / Consider: | Suggestion | Worth considering |
| FYI | Informational | None |

Lead with what matters: correctness and security first, then structural regressions and missed simplifications, then everything else. A few high-conviction comments beat a long list; if there is one structural problem and ten nits, the structural problem is the review.

## Using a Second Reviewer

A different model or person has different blind spots. A useful pattern: one agent writes, another reviews correctness and architecture, the author addresses feedback, a human decides. Give the reviewer the spec, the intended change, and the severity scale.

## Dead Code Hygiene

After a refactor, list code that is now unreachable or unused and ask before deleting:

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in utils/date: replaced by formatDate()
- OldTaskCard component: replaced by TaskCard
Safe to remove these?
```

Do not leave it lying around, and do not delete what you are unsure about.

## Review Speed

Slow reviews block teams. Respond within one business day at the very most, and sooner when not deep in focused work. Fast individual responses matter more than a quick final approval. For huge changes, ask for a split instead of reviewing the whole.

## Handling Disagreements

1. Technical facts and data beat opinions.
2. The style guide is the authority on style.
3. Design is judged on engineering principles, not preference.
4. Consistency with the codebase is acceptable if it does not degrade overall health.

Do not accept "I will clean it up later"; require it before merge unless it is a real emergency, and otherwise require a filed, assigned issue.

## Honesty in Review

- No rubber stamps: "LGTM" without evidence helps nobody.
- Do not soften real issues; a production bug is not "a minor concern".
- Quantify where you can ("this N+1 adds roughly one query per list item").
- Push back on approaches with clear problems and propose alternatives.
- If the author has full context and disagrees, defer gracefully. Comment on code, not people.

## Dependency Discipline

Before adding a dependency: does the existing stack already solve it, how big is it, is it maintained, does it have known vulnerabilities, is the license compatible? Prefer the standard library and existing utilities; every dependency is a liability.

Upgrading one is a code change like any other. The riskiest are bulk "bump deps" merges.

1. Read the changelog, not just the version number. Semver is a promise a maintainer may not have kept. For a major bump, read the migration notes.
2. One dependency (or small related group) per change, so a break names its cause and reverts cleanly.
3. Let tests decide: green before and after. Thin coverage around the dependency is itself the finding; add a test first.
4. Mind the transitive graph: review the lockfile diff, not only the manifest.
5. Commit the lockfile, review its diff, never hand-edit it.

For audit findings and supply-chain risk (typosquatting, compromised maintainers), use harness-verify:security-and-hardening.

## Review Checklist

```markdown
## Review: [title]
Context:      [ ] I understand what and why
Correctness:  [ ] matches spec  [ ] edge cases  [ ] error paths  [ ] adequate tests
Readability:  [ ] clear names  [ ] straightforward logic  [ ] no needless complexity
Architecture: [ ] existing patterns  [ ] low coupling  [ ] right abstraction
              [ ] refactor reduces complexity  [ ] no feature logic in shared modules
Security:     [ ] no secrets  [ ] validated input  [ ] no injection  [ ] auth checks  [ ] external data untrusted
Performance:  [ ] no N+1  [ ] nothing unbounded  [ ] pagination
Verification: [ ] tests pass  [ ] build succeeds  [ ] manual check if relevant
Verdict:      [ ] Approve  [ ] Request changes
```

See also harness-core's security and performance checklists.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, good enough" | Unreadable, insecure or misplaced code compounds into debt. |
| "I wrote it, so I know it is right" | Authors are blind to their own assumptions. |
| "We will clean it up later" | Later never comes. Require it before merge. |
| "AI-generated code is probably fine" | It is plausible and confident even when wrong; scrutinize more. |
| "Tests pass, so it is good" | Tests miss architecture, security and readability problems. |
| "The refactor makes it cleaner" | Relocating complexity is not reducing it. |
| "It is only a small addition to this file" | Small diffs still bloat files and bolt branches onto unrelated flows. |
| "It is just a version bump" | A bump is a behavior change you did not write. |
| "Upgrade everything in one PR" | A broken bulk bump hides the culprit. |

## Red Flags

- Merges with no review, or review that only checks that tests pass
- "LGTM" without evidence
- Security-sensitive changes with no security-focused review
- Oversized PRs; bug fixes with no regression test
- Comments with no severity labels
- Accepting "I will fix it later"
- Refactors that move code without reducing concepts
- Growing an already-large file instead of decomposing
- Conditionals scattered through unrelated paths
- Near-duplicates of canonical helpers; feature logic in shared modules
- Bulk dependency bumps without changelog review; hand-edited or unreviewed lockfiles

## Verification

- [ ] All Critical issues resolved
- [ ] All required changes resolved or deferred with justification
- [ ] Tests pass and the build succeeds
- [ ] The verification story is documented
- [ ] Dependency upgrades were changelog-reviewed, isolated, tested, and their lockfile diff read

Presumptive blockers: surface each and propose the simpler design, escalating to required only when the change actively worsens structure. They are: a refactor that relocates complexity, a file pushed past the size boundary with no decomposition, feature logic in a shared module, a near-duplicate of a canonical helper, and a silent fallback hiding an unclear invariant.
