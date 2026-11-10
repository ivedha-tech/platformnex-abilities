---
description: Implement tasks incrementally - build, test, verify, commit. Add "auto" to run the whole plan in one approved pass.
disable-model-invocation: true
---

Invoke the harness-build:incremental-implementation skill together with harness-verify:test-driven-development.

## Modes

- `/build`: implement the next pending task, then stop (one careful slice at a time).
- `/build auto`: generate the plan if needed, get a single approval, then implement every task without stopping between them.

`$ARGUMENTS` selects the mode. Treat `auto` or `all` as autonomous mode; anything else, or nothing, is single-task mode. Autonomous mode is not faster per task; it runs the same test-driven loop and only removes the human stepping between tasks.

## Default: one task

Take the next pending task from the plan, then:

1. Read its acceptance criteria
2. Load the relevant context (existing code, patterns, types)
3. Write a failing test for the expected behavior (RED)
4. Write the minimum code to pass it (GREEN)
5. Run the full test suite to check for regressions
6. Run the build to confirm it compiles
7. Commit with a descriptive message
8. Mark the task complete and stop

## Autonomous: the whole plan (`/build auto`)

Use this once a spec exists and you want plan and build collapsed into one run. It removes the stepping between tasks, not the verification: every task still earns a passing test and its own commit.

1. **Require a spec.** Look only at known paths: `SPEC.md` at the repo root, `docs/SPEC.md`, or a file under `spec/`. A README or arbitrary doc does not count. If none exists, stop and tell the user to run `/spec` first. Do not invent requirements.
2. **Establish a clean baseline.** Run `git status --porcelain`. If anything is uncommitted outside the expected planning artifacts (`SPEC.md`, `docs/SPEC.md`, `spec/*`, `tasks/plan.md`, `tasks/todo.md`), stop and ask the user to commit, stash, or say how to proceed. Per-task commits must not absorb unrelated local work, or clean rollback breaks.
3. **Plan if needed.** If `tasks/plan.md` is missing, invoke harness-define:planning-and-task-breakdown to create it.
4. **Single checkpoint.** Present the full plan and wait for an unambiguous yes ("approve", "go", "yes"). Hedged replies ("looks reasonable", "I guess") are not approval. This is the only human gate; after approval, run autonomously. If you generated `tasks/plan.md`, commit it as one preparatory commit now so it does not leak into the first task's commit.
5. **Execute every task in dependency order,** using declared dependencies or, if none, the plan's order. Run the full single-task loop for each (RED, GREEN, regression, build, commit, mark complete). Stage only the files that task touched plus its status update, never a blanket `git add -A`, and make one commit per task so every point is a clean rollback.
6. **Stop and ask the user** (do not push through) when:
   - a test cannot be made to pass, or the build breaks without an obvious fix: follow harness-verify:debugging-and-error-recovery
   - the spec is ambiguous, or a task needs a decision the spec does not cover
   - a task is high-risk or irreversible (auth or permission changes, destructive data migrations, payments, deletions, deploys, secrets, or anything `git revert` cannot undo): follow harness-build:doubt-driven-development and get explicit sign-off first

   After the user resolves a blocker they re-run `/build auto`, which resumes from the next pending task.
7. **Summarize at the end:** tasks completed, tests added, commits made, and anything skipped, flagged, or left for the user.

If any step fails, follow harness-verify:debugging-and-error-recovery.
