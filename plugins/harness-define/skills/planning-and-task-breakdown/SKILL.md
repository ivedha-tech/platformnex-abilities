---
name: planning-and-task-breakdown
description: Turns a spec or clear requirements into an ordered plan of small, vertically sliced tasks with acceptance criteria, verification steps, dependencies, and checkpoints. Use when a spec exists and needs implementable tasks, when work feels too large to start, when scope must be estimated or communicated, or when work can be parallelised.
---

# Planning and Task Breakdown

## Overview

Split work into small, verifiable tasks with explicit acceptance criteria. Reliable completion depends on it: each task should be small enough to implement, test, and verify in one focused session.

## When to Use

- A spec needs to become implementable units
- A task feels too big or vague to begin
- Work will be spread across agents or sessions
- Scope must be communicated to a human
- The implementation order is unclear

**When NOT to use:** single-file changes with obvious scope, or a spec that already contains well-defined tasks.

## The Planning Process

### Step 1: Plan read-only

Before writing code:

- Read the spec and the relevant parts of the codebase
- Note existing patterns and conventions
- Map dependencies between components
- Record risks and unknowns

Write no code while planning. The output is a plan document at `tasks/plan.md` plus a task list in the task list target (below).

### Step 2: Map the dependency graph

```
Database schema
  |-- API models/types
  |     |-- API endpoints
  |     |     |-- Frontend API client
  |     |           |-- UI components
  |     |-- Validation logic
  |-- Seed data / migrations
```

Build from the bottom up: foundations first.

### Step 3: Slice vertically

Avoid layer-by-layer tasks (all schema, then all endpoints, then all UI, then "connect everything"). Prefer end-to-end slices, each delivering something working and testable:

```
Task 1: User can register (schema + API + UI)
Task 2: User can log in (auth schema + API + UI)
Task 3: User can create an item (schema + API + UI)
Task 4: User can view the list (query + API + UI)
```

### Step 4: Write each task

```markdown
## Task [N]: [Short title]

**Description:** One paragraph on what this accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]

**Verification:**
- [ ] Tests pass: [the repository's focused test command]
- [ ] Build succeeds: [the repository's build command]
- [ ] Manual check: [what to verify]

**Dependencies:** [task numbers or "none"]

**Files likely touched:**
- `path/to/file`
- `path/to/test`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 | Large: 5+]
```

### Step 5: Order and add checkpoints

1. Satisfy dependencies first
2. Leave the system working after every task
3. Add a verification checkpoint every 2-3 tasks
4. Put high-risk tasks early so failure is cheap

```markdown
## Checkpoint: after tasks 1-3
- [ ] All tests pass
- [ ] Build is clean
- [ ] Core user flow works end to end
- [ ] Reviewed with the human before continuing
```

## Task Sizing

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| XS | 1 | One function or config change | Add a validation rule |
| S | 1-2 | One component or endpoint | Add an endpoint |
| M | 3-5 | One feature slice | Registration flow |
| L | 5-8 | Multi-component feature | Search with filters and paging |
| XL | 8+ | Too large; split it | n/a |

Split anything L or larger; agents do best with S and M. Split further when:
- It would take more than one focused session (roughly 2+ hours)
- Acceptance criteria will not fit in three bullets
- It spans two or more independent subsystems
- The title needs "and"

## Output Files

- **Plan:** `tasks/plan.md`, always markdown. Design decisions, risks, and open questions do not fit tracker items.
- **Tasks:** recorded in the task list target. Create `tasks/` if missing.

**Never overwrite an unfinished plan.** Check whether `tasks/plan.md` or `tasks/todo.md` already exist with unchecked tasks. If this is the same work being revised, update in place. If it is different work, stop and ask: those tasks may be mid-build in another session. Offer: finish the old plan, explicitly discard it, or put the new plan elsewhere. Likewise never bulk-close or delete another plan's open tracker items.

### Task list target

Defined here; everything else in this skill defers to it.

- **Default:** a checklist at `tasks/todo.md`.
- **External tracker:** if the project's agent instructions or the user name an issue tracker, create one item per task instead of `tasks/todo.md`. Put acceptance criteria and verification in the item body, express dependencies with the tracker's linking feature, and record checkpoints as items (or as a checklist in the plan if the tracker has no equivalent). Note the tracker in `tasks/plan.md` and keep the plan's Task List as an ordered index of item IDs or links, not a duplicate checklist.

## Plan Template

```markdown
# Implementation Plan: [Name]

## Overview
[One paragraph]

## Architecture Decisions
- [Decision and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, build clean

### Phase 2: Core features
- [ ] Task 3: ...

### Checkpoint: Core features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 4: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|

## Open Questions
- [Needs human input]
```

## Parallelisation

- **Safe in parallel:** independent feature slices, tests for finished features, documentation
- **Sequential:** migrations, shared-state changes, dependency chains
- **Needs coordination:** features sharing an API contract; define the contract first, then split

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I will work it out as I go" | That produces tangles and rework; ten minutes of planning saves hours. |
| "The tasks are obvious" | Writing them down exposes hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning is the work; building without it is typing. |
| "I can keep it all in my head" | Context is finite. A written plan survives session boundaries. |
| "The old plan is stale, I will replace it" | Unchecked tasks may be mid-build elsewhere. Overwriting destroys state that exists nowhere else. Ask. |

## Red Flags

- Implementation begins with no written task list
- An existing plan with unchecked tasks is overwritten for different work without asking
- `tasks/todo.md` written although an external tracker was designated, or tasks split across both
- Tasks like "implement the feature" with no acceptance criteria
- No verification steps
- Everything is XL
- No checkpoints
- Dependency order ignored

## Verification

- [ ] Every task has acceptance criteria and a verification step
- [ ] Dependencies are identified and the order respects them
- [ ] Tasks are recorded in the task list target
- [ ] No incomplete earlier plan was overwritten without explicit confirmation
- [ ] No task touches more than about five files
- [ ] Checkpoints separate the major phases
- [ ] The human reviewed and approved the plan

## See Also

Acceptance criteria are per task and ask "did we build the right thing?". They sit on top of the project-wide definition of done, the standing bar every task clears; see harness-core's definition-of-done reference.
