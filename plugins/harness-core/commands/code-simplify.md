---
description: Simplify code for clarity and maintainability without changing behavior
disable-model-invocation: true
---

Invoke the harness-build:code-simplification skill.

Simplify recently changed code (or the scope the user names) while preserving exact behavior:

1. Read CLAUDE.md and study the project's conventions
2. Identify the target: recent changes unless a wider scope is given
3. Understand the code's purpose, callers, edge cases and test coverage before touching it
4. Look for opportunities:
   - deep nesting: guard clauses or extracted helpers
   - long functions: split by responsibility
   - nested ternaries: if/else or switch
   - generic names: descriptive names
   - duplicated logic: shared functions
   - dead code: remove after confirming it is unused
5. Apply each simplification on its own and run tests after each
6. Confirm all tests pass, the build succeeds, and the diff is clean

If tests fail after a change, revert that change and reconsider. Then use harness-verify:code-review-and-quality on the result.
