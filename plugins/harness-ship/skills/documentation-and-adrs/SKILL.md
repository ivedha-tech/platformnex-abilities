---
name: documentation-and-adrs
description: Records the reasoning behind a codebase through architecture decision records, why-focused comments, API docs, READMEs, changelogs, and agent-facing project rules, plus a prose review pass. Use when making or revisiting an architectural decision, changing a public API, shipping user-visible behavior, onboarding people or agents, or when the same explanation keeps being repeated.
---

# Documentation and ADRs

## Overview

Document decisions, not just code. Code shows what was built; documentation should say why it was built that way and what else was considered. That context is what future engineers and agents lack, and it stops settled questions being reopened.

## When to Use

- Significant architectural choice, or a choice between competing approaches
- Adding or changing a public API
- Shipping behavior users will notice
- Onboarding a person or an agent
- Explaining the same thing for the third time

Not for: obvious code, comments that restate the code, or throwaway prototypes.

## Architecture Decision Records

ADRs are the most valuable documentation to write. Write one for decisions that are expensive to reverse: a framework or major dependency, a data model, an authentication strategy, an API style, hosting or build infrastructure.

### Match the existing convention first

Before creating an ADR, look for an established convention: existing ADRs, project instructions, and ADR tooling or config. If one exists it overrides the defaults here. Match:

- **Location and format:** directory, file extension, markup language
- **Numbering and naming:** continue the sequence and filename pattern; do not restart or add a second scheme
- **Headings:** reuse the project's section set

If the evidence conflicts, say so rather than silently picking another scheme. Use the default below only when no convention can be found.

### Default template

Store in `docs/decisions/` with sequential numbers:

```markdown
# ADR-001: <decision in a phrase>

## Status
Proposed | Accepted | Superseded by ADR-XXX | Deprecated

## Date
YYYY-MM-DD

## Context
The problem and the constraints that shaped it (requirements, team size, operational limits).

## Decision
What we chose, stated plainly.

## Alternatives Considered
### <Option A>
- Pros / Cons
- Rejected because: <specific reason>
### <Option B>
...

## Consequences
What gets easier, what gets harder, what must now be learned or maintained.
```

### Lifecycle

Proposed, then Accepted, then Superseded or Deprecated. Never delete an old ADR: it is history. When a decision changes, write a new ADR that supersedes and links the old one.

## Inline Documentation

Comment the why, not the what.

```typescript
// Bad: restates the code
// increment counter
counter += 1;

// Good: explains intent and a known limit
// Fixed window that starts at the first request after expiry, not on a
// clock boundary. Known gap: a client can use the full limit just before
// and just after a reset.
if (now - windowStart > WINDOW_MS) { counter = 0; windowStart = now; }
```

Do not comment self-explanatory code, leave TODOs you could just do, or keep commented-out code (version control remembers it). Do document gotchas where they bite, and point to the ADR that explains the design:

```typescript
/** Must run before first render; after hydration it causes a flash of
 *  unstyled content because theme context is unavailable during SSR.
 *  See ADR-003. */
export function initializeTheme(theme: Theme): void { /* ... */ }
```

## API Documentation

Prefer documentation that lives with the types: parameters, return value, thrown errors, and one short example.

```typescript
/**
 * Creates a task.
 * @param input title (required, max 200 chars), description optional
 * @returns the task with server-generated id and timestamps
 * @throws ValidationError if the title is empty or too long
 * @throws AuthenticationError if the caller is not signed in
 */
export async function createTask(input: CreateTaskInput): Promise<Task> { /* ... */ }
```

For HTTP APIs, maintain a machine-readable description (an OpenAPI document or equivalent) listing each path, request schema, and every response code including validation errors. See harness-build:api-and-interface-design for the contract itself.

## README

Every project needs: a one-paragraph description; a quick start (clone, install, configure from the example env file, run); a commands table (dev, test, build, lint); a short architecture overview linking to ADRs; and contribution guidance. A reader should be able to run the project from the README alone.

## Changelog

Record shipped changes by version and date, grouped as Added, Changed, Fixed (and Removed or Security when relevant), each with a reference to the issue or pull request.

## Documentation for Agents

- Rules and instruction files record conventions so agents follow them.
- Specs stay current so agents build the right thing.
- ADRs stop agents from re-deciding settled questions.
- Inline gotchas keep agents out of known traps.

See harness-core for how these feed the context an agent loads.

## Prose Review

After the technical content is right, review the wording for its readers without changing the decision or its limits.

1. List what must survive: names, numbers and units, commands, paths, links, conditions, trade-offs, and uncertainty. Check them against the code and decision context; flag what you cannot substantiate.
2. Replace stock openings, promotional adjectives, and repeated summaries with the concrete information the reader needs. Do not substitute an invented example or a stronger guarantee for an unsupported claim. Keep necessary technical repetition and the project's terms.
3. Compare the edit with the original and its sources. Restore any lost qualifier, check that commands and examples still work as written, and report unresolved factual questions instead of polishing them away.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The code is self-documenting" | It shows what, not why, not what was rejected, not which constraints apply. |
| "We'll document once the API stabilizes" | Documenting is the first test of the design and speeds stabilization. |
| "Nobody reads docs" | Agents, new engineers, and your future self do. |
| "ADRs are overhead" | Ten minutes now saves a two-hour debate on the same question later. |
| "Comments go stale" | Comments about why are stable; only restating what goes stale, so do not write those. |

## Red Flags

- Significant decisions with no written rationale
- Public APIs without docs or types
- A README that cannot get someone running
- Commented-out code instead of deletion
- TODOs that have sat for weeks
- No ADRs in a project with real architectural choices
- Docs that restate code instead of explaining intent

## Verification

- [ ] ADRs exist for significant decisions and follow the project's convention
- [ ] README covers quick start, commands, and architecture
- [ ] Public functions document parameters, returns, and errors
- [ ] Gotchas are documented where they matter
- [ ] No commented-out code remains
- [ ] Rules and instruction files are current
- [ ] Prose edits keep source details, trade-offs, and qualifiers and add no unsupported guarantees
