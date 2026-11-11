---
name: incremental-implementation
description: Delivers changes as thin, verified slices instead of one large pass. Use when implementing any change that spans more than one file, picking up the next task from a plan, hiding unfinished work behind a flag, or when a task feels too big to land in one step.
---

# Incremental Implementation

## Overview

Build one thin slice at a time: implement, test, verify, commit, then expand. Every slice leaves the system working and testable. Large features stay manageable because a failure is always traceable to the last small step.

## When to Use

- Any multi-file change, or a feature taken from a task breakdown
- Refactoring existing code
- Whenever you are about to write more than about 100 lines before running anything

Not needed for single-function, single-file edits where scope is already minimal.

## The Cycle

Implement the smallest complete piece, then test it (write a test if none exists), verify it (tests, build, a manual check), commit it (see harness-build:git-workflow-and-versioning), and move on without restarting.

## Choosing Slices

- **Vertical slices (default).** Each slice is one working path through the stack, for example create, then list, then edit, then delete, each with storage, API and UI where relevant.
- **Contract-first.** When teams or layers work in parallel, slice 0 fixes the interface (types, schema, spec); backend and frontend then build against it separately and integrate last. See harness-build:api-and-interface-design.
- **Risk-first.** Prove the least certain piece (a new protocol, an unfamiliar integration) before building on it, so failure is discovered early.

## Rules

**Simplicity first.** Ask what the simplest thing is that could work. After writing, ask whether fewer lines or fewer abstractions would do, and whether you are building for today's task or an imagined future. A generic event bus for one notification, or a config-driven builder for three forms, is a miss. Three similar lines beat a premature abstraction. Write the obviously correct version first and optimize only once tests prove it correct.

**Scope discipline.** Touch only what the task needs. Do not tidy neighbouring code, reorder imports in files you are not changing, delete comments you do not understand, add unrequested features, or modernize syntax in files you only read. Record such findings instead:

```
NOTICED, NOT TOUCHING:
- src/utils/format.ts: unused import (unrelated)
- auth middleware: error messages could be clearer (separate task)
```

**One thing at a time.** A slice changes one logical thing. A new component, a refactor of another, and a build-config tweak are three commits.

**Stay buildable.** After each slice the project builds and existing tests pass.

**Flags for unfinished work.** If increments must merge before the feature is ready, put the user-visible part behind a flag that defaults to off.

**Safe defaults.** New behaviour is opt-in and conservative (for example, notifications off unless requested).

**Easy to revert.** Prefer additive changes. Keep edits to existing code small. Pair migrations with a rollback. Do not delete and replace the same thing in one commit.

## Directing an Agent

Name the slice and its boundaries: "Do only the schema change and the endpoint for task 3; leave the UI for the next slice; run the repository's test and build commands when done." State what is out of scope as clearly as what is in.

## After Each Slice

Use the repository's own commands, discovered rather than assumed:

- [ ] The slice does one thing, completely
- [ ] Existing tests pass
- [ ] Build succeeds
- [ ] Type check and lint pass where the stack has them
- [ ] The new behaviour works as intended
- [ ] Committed with a descriptive message

Re-run a command only after the code changed since its last successful run; repeating it on unchanged code tells you nothing.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll test it all at the end" | A bug in slice 1 silently corrupts slices 2 to 5. |
| "Doing it at once is faster" | Only until something breaks and 500 changed lines are suspects. |
| "Too small to commit separately" | Small commits cost nothing; big ones hide bugs and block rollback. |
| "I'll add the flag later" | Unfinished work must not be user-visible. Flag it now. |
| "This refactor is small enough to include" | Mixed refactor and feature is harder to review and to debug. |
| "Let me re-run the build to be sure" | With no code change since the last pass, it adds no information. |

## Red Flags

- 100+ lines written without running tests
- Unrelated changes bundled in one slice
- "Quickly adding this too" scope creep
- Verify step skipped for speed; build or tests broken between slices
- Uncommitted changes piling up
- Abstractions built before a third use case exists
- New utility files for one-off operations
- Touching files outside the task "while I'm here"

## Verification

- [ ] Each slice was tested and committed on its own
- [ ] Full test suite passes and the build is clean
- [ ] The feature works end to end as specified
- [ ] No uncommitted changes remain
- [ ] The final bar in harness-core's definition-of-done reference is met
