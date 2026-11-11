---
name: spec-driven-development
description: Writes a structured, reviewable specification before any code, moving through gated phases (specify, plan, tasks, implement) with human approval between them, and decomposing multi-capability requests into a capability map first. Use when starting a project, feature, or significant change with no spec, when requirements are vague or ambiguous, or when one request bundles several independently testable capabilities.
---

# Spec-Driven Development

## Overview

Write down what is being built, why, and how everyone will know it is done, before writing code. The spec is the shared source of truth between the agent and the human engineer. Code without a spec is guessing.

## When to Use

- Starting a project or feature
- Requirements are ambiguous or incomplete
- The change spans several files or modules
- An architectural decision is about to be made
- The work would take more than about 30 minutes

**When NOT to use:** one-line fixes, typos, or changes whose requirements are already unambiguous and self-contained.

## The Gated Workflow

```
SPECIFY --> PLAN --> TASKS --> IMPLEMENT
  human     human    human      human
  review    review   review     review
```

Do not enter a phase until the previous one is approved. A scope check (Phase 0) precedes all of them, but only when one request bundles several independently testable capabilities.

### Phase 0: Scope check

Most requests describe one capability; skip this phase for those.

**Decompose first when:**
- The request names distinct capabilities with their own consumers or data (identity, billing, notifications, reporting)
- Acceptance criteria fall into groups that could ship and be verified separately
- One capability could be dropped or replaced without rewriting the others' requirements

**Propose a capability map before any spec**, small enough to review in a minute:

```markdown
# Capability Map: [Initiative]

| Module id | Responsibility | Depends on |
|---|---|---|
| identity | Accounts, sessions, SSO | none |
| billing | Plans, invoices, payments | identity |
| notifications | Email and webhook fan-out | identity |
| reporting | Usage dashboards | billing, notifications |

Build order: identity, then billing and notifications, then reporting
```

- **Stable ids.** Kebab-case, chosen once, never renamed mid-initiative, so later specs and plans can select work by id.
- **One-way dependencies.** If two modules need each other, they are one module.
- **Contracts at the boundary.** The map says billing depends on identity; the contract itself belongs in the provider's spec (see `harness-build:api-and-interface-design`).

The human approves the map (boundaries, dependency direction, build order) before any module spec is written. Then run Specify, Plan, Tasks, Implement per module in dependency order, saving the map at the project root and each spec beside it by id (`SPEC-identity.md`, `SPEC-billing.md`).

### Phase 1: Specify

Start from the high-level vision and ask clarifying questions until requirements are concrete (use `harness-define:interview-me` when intent itself is unclear).

**State assumptions before writing anything:**

```
ASSUMPTIONS I AM MAKING:
1. A web application, not native mobile
2. Session cookies for auth, not JWT
3. PostgreSQL, based on the existing schema
4. Modern browsers only
-> Correct me now or I proceed with these.
```

Silently filling gaps is the most dangerous kind of misunderstanding.

**Cover six areas:**

1. **Objective:** what, why, for whom, and what success looks like.
2. **Commands:** full runnable commands with flags (build, test with coverage, lint, dev server), not just tool names.
3. **Project structure:** where source, tests, and docs live.
4. **Code style:** one real snippet beats paragraphs of description; include naming and formatting rules.
5. **Testing strategy:** framework, test locations, coverage expectations, which levels cover which concerns.
6. **Boundaries**, in three tiers:
   - Always: run tests before commits, follow naming conventions, validate inputs
   - Ask first: schema changes, new dependencies, CI changes
   - Never: commit secrets, edit vendored code, remove failing tests without approval

**Template:**

```markdown
# Spec: [Name]

## Objective
[What and why; user stories or acceptance criteria]

## Tech Stack
[Framework, language, key dependencies and versions]

## Commands
[Build, test, lint, dev]

## Project Structure
[Directory layout]

## Code Style
[Snippet and conventions]

## Testing Strategy
[Framework, locations, coverage, levels]

## Boundaries
- Always: ...
- Ask first: ...
- Never: ...

## Success Criteria
[Specific, testable conditions]

## Open Questions
[Needs human input]
```

**Existing spec tooling.** If the project already uses a specification system, keep its format and storage rather than creating a second spec file. This skill supplies the clarification, content, and approval gates; the tool supplies the representation.

**Turn vague wishes into criteria:**

```
REQUIREMENT: "Make the dashboard faster"
SUCCESS CRITERIA:
- Largest contentful paint under 2.5 s on a 4G profile
- Initial data load under 500 ms
- Layout shift score under 0.1
-> Are these the right targets?
```

**Stop after writing the spec.** Summarise it, list Open Questions, ask for approval or changes, and end the turn. Do not start planning or coding in that turn.

### Phase 2: Plan

From the approved spec:

1. Identify components and their dependencies
2. Decide build order
3. Record risks and mitigations
4. Separate parallel work from sequential work
5. Place verification checkpoints between phases

Follow `harness-define:planning-and-task-breakdown` for the mechanics (dependency graph, vertical slicing, sizing); it is the authority if this summary differs. Save the plan to `tasks/plan.md` and the task list in the target that skill defines (default `tasks/todo.md`). The human should be able to read the plan and say "yes, that approach" or "change X".

### Phase 3: Tasks

Split the plan into tasks that each fit one focused session, have explicit acceptance criteria and a verification step, are ordered by dependency, and touch about five files or fewer.

```markdown
- [ ] Task: [description]
  - Acceptance: [what is true when done]
  - Verify: [test command, build, or manual check]
  - Files: [expected files]
```

`harness-define:planning-and-task-breakdown` is the authority for sizing and ordering.

### Phase 4: Implement

Work one task at a time using `harness-build:incremental-implementation` and `harness-verify:test-driven-development`. Use `harness-build:context-engineering` to load only the relevant spec sections and files for each step.

## Keeping the Spec Alive

- Change the spec first when a decision changes, then change the code.
- Reflect added or cut scope in the spec.
- Commit it with the code.
- Link each pull request to the spec section it implements.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It is simple, no spec needed" | Short work needs a short spec, not none. Two lines of acceptance criteria will do. |
| "I will write the spec after coding" | That is documentation. A spec's value is forcing clarity beforehand. |
| "A spec slows us down" | Fifteen minutes of spec is cheaper than hours of rework. |
| "Requirements will change anyway" | Hence a living document. A stale spec still beats none. |
| "The user knows what they want" | Even clear requests carry implicit assumptions; the spec surfaces them. |
| "It is one big feature; splitting is overhead" | If criteria cluster into independent groups, a monolithic spec makes every task reason over the whole contract. A ten-line map is cheap. |
| "I will decompose during planning" | Planning slices tasks inside a spec; by then the oversized spec exists. Boundaries come before the spec. |

## Red Flags

- Code written with no written requirements
- Asking "should I just start?" before defining done
- Building things no spec or task mentions
- Architectural decisions left undocumented
- Skipping the spec because it is "obvious"
- Writing the spec and starting the plan or code in the same turn
- One spec covering several independently testable capabilities
- Module boundaries decided implicitly during implementation

## Verification

- [ ] The spec covers all six areas
- [ ] The human reviewed and approved it, in a later turn than it was written
- [ ] Success criteria are specific and testable
- [ ] Always / Ask first / Never boundaries are set
- [ ] The spec is saved in the repository
- [ ] For multi-capability requests, an approved capability map (ids, dependency direction, build order) preceded every module spec
- [ ] Each module spec traces to a module id in the map
