---
name: commit-message
description: Writes a git commit message for the staged changes. Use when the user asks to commit, or asks for a commit message.
---

# commit-message

1. Read the staged diff with `git diff --cached`. If nothing is staged, say so and stop.
2. Read the last 10 subjects with `git log --oneline -10` and follow their style (for example `feat:` / `fix:` prefixes).
3. Write a subject line under 72 characters, in the imperative ("Add", not "Added"), that says what changed and why.
4. If the change needs it, add a blank line and a short body: what changed, why, and anything a reviewer should check. No bullet list of every file.
5. Show the message and ask before running `git commit`.
