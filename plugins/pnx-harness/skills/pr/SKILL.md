---
name: pr
description: Prepares the current branch for review by running the checks, reviewing the diff, writing the pull request description from the org template and opening the pull request. Use when work on a branch is finished and it needs a pull request on a PlatformNEX service repository.
---

# Open a pull request (gate G3)

## Overview

A pull request is the unit of review. This skill gets a branch to the point where a human can approve it in PlatformNEX: checks pass, the diff is clean, and the description says what changed, how it was tested and how to undo it.

## When to Use

- Work on a branch is finished
- A pull request exists and its description or checks need bringing up to standard

## Process

1. Confirm you are not on the default branch and the branch name follows `type/<issue>-slug`.
2. Run `make check` (or the repository's documented check command). If it fails, fix the cause. Never weaken a test or a scanner rule to pass.
3. Review `git diff main...HEAD` yourself first: leftover debug code, secrets, personal data in fixtures, unrelated changes, missing tests. harness-verify:code-review-and-quality gives the five axes.
4. If the diff is over about 400 lines, propose how to split it.
5. If the change touches auth, data handling, the Dockerfile, `cloudbuild.yaml`, the GitOps overlay or dependencies, run the `security-auditor` agent from the harness-core plugin and include its findings.
6. Write the description using the org pull request template: what and why, how it was tested, risk and rollback, linked issue. Tick the AI-assistance box when it applies. Never put `[skip ci]` in the title or a commit.
7. Show the description, then run `git push -u origin HEAD` and `gh pr create` when the user confirms.
8. Tell the user what happens next: the "PlatformNEX review" check needs one approval given in PlatformNEX (approvals on GitHub do not count), and a preview is available with `pnx dev preview` (see `pnx-fast-dev:fast-dev`).

You do not approve or merge.

## Verification

- [ ] `make check` passed, with the output seen
- [ ] The description has all four parts and links the issue
- [ ] Security findings are included when the change touched a sensitive area
- [ ] Nothing was pushed or opened without the user's confirmation
