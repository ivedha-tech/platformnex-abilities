---
description: Run the TDD workflow - write failing tests, implement, verify. For bugs, use the Prove-It pattern.
disable-model-invocation: true
---

Invoke the harness-verify:test-driven-development skill.

New features:
1. Write tests describing the expected behavior (they should FAIL)
2. Implement the code to make them pass
3. Refactor while keeping tests green

Bug fixes (Prove-It pattern):
1. Write a test that reproduces the bug (it must FAIL)
2. Confirm it fails
3. Implement the fix
4. Confirm it passes
5. Run the full suite for regressions

For browser-related issues, also invoke harness-verify:browser-testing-with-devtools to verify in a real browser.
