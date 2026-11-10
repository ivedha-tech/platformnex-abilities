# Definition of Done (reference)

A standing, project-wide bar every change must clear. Acceptance criteria vary per task and ask "did we build the right thing?". The Definition of Done is the same every time and asks "is it finished to our standard?". It is the final gate for planning, implementation and shipping work.

## Definition of Done vs acceptance criteria

| | Acceptance criteria | Definition of Done |
|---|---|---|
| Scope | One task or spec | Every increment |
| Changes | Differs per item | Fixed and reused |
| Answers | "Did we build this thing?" | "Is it ready?" |
| Example | "User can reset password via email link" | "Tests pass, no regressions, docs updated" |

A task is done only when its acceptance criteria are met and the standing checklist is satisfied. Skipping either leaves work that looks finished but is not.

## Standing checklist

### Correctness
- [ ] All acceptance criteria for the task are met
- [ ] Behavior verified at runtime, not just compiled or typechecked
- [ ] New behavior is covered by tests that fail without the change and pass with it
- [ ] Existing tests pass; no regressions
- [ ] Edge cases and error paths handled, not just the happy path

### Quality
- [ ] Naming and structure show intent; no comments needed to explain what code does
- [ ] No duplicated business logic
- [ ] No dead code, debug output, or commented-out blocks
- [ ] Changes scoped to the task; no unrelated refactors
- [ ] Lint and formatting pass

### Integration
- [ ] Works with the rest of the system, not only in isolation
- [ ] Migrations, config changes and feature flags accounted for
- [ ] Backward compatibility considered for any public interface or API change

### Documentation
- [ ] Public interfaces, APIs and user-facing behavior documented
- [ ] Decisions worth keeping are recorded (an ADR)
- [ ] Docs describe current state in timeless language, not change history

### Ship-readiness
- [ ] Security reviewed for untrusted input, auth, or data handling
- [ ] Observability in place for new critical paths (logs, metrics, traces)
- [ ] Rollback path exists for anything risky
- [ ] A human reviewed and approved before merge or deploy

## How to apply

- Per task: confirm Correctness and Quality before checking the task off.
- Per feature: confirm Integration and Documentation before calling it complete.
- Per release: this checklist is the floor; deploy-specific gates go on top.

Tailor the list once for the project, then reuse it unchanged. A Definition of Done renegotiated every sprint is not one.

## Red flags

- "It's done, I just haven't run it": unverified work is not done.
- "Tests pass" used as a synonym for done while docs, regressions or runtime checks are skipped.
- A looser bar under deadline pressure.
- Acceptance criteria treated as the whole bar.
- "Done" declared before a required human review.
