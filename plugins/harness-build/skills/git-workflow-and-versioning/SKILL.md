---
name: git-workflow-and-versioning
description: Structures git practice: atomic commits, clear messages, short-lived branches, worktrees, pre-commit hygiene, semantic versioning, tags and changelogs. Use when committing, branching, splitting a messy working tree into clean commits, writing a commit message or changelog entry, opening or reviewing a pull request, or cutting a release.
---

# Git Workflow and Versioning

## Overview

Commits are save points, branches are sandboxes, history is documentation. When code is produced quickly, disciplined version control is what keeps changes reviewable and reversible.

## When to Use

Always; every code change goes through git.

## Core Principles

### Trunk-based by default

Keep `main` deployable and merge short-lived branches within one to three days. Long-lived branches accumulate merge risk and delay integration. Release branches are fine for stabilizing a release while main moves on. Prefer flags over long branches for unfinished work. Teams on another model should still keep the commit discipline below; it matters more than the branching scheme.

### Commit early and often

Each working increment gets its own commit: implement, test, verify, commit, next. If the following change breaks something, you return to the last good state.

### Atomic commits

One logical change per commit. "Add creation endpoint with validation" then "Add creation form" is good; "add feature, fix sidebar, bump deps, refactor utils" is not.

### Messages explain why

```
<type>: <short description>

<optional body: why, not what>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. The body states intent and constraints the diff cannot show.

### Separate concerns

No formatting mixed with behaviour, no refactor mixed with feature. Submit them as separate commits and ideally separate pull requests. A trivial rename inside a feature commit is a reviewer's call.

### Size

About 100 lines is easy to review and revert, about 300 is acceptable for one logical change, and past roughly 1000 you should split. See harness-verify:code-review-and-quality for splitting strategies.

## Branches

Branch from the team's default branch, name by purpose (`feature/...`, `fix/...`, `chore/...`, `refactor/...`), keep them short, and delete them after merge.

## Worktrees for Parallel Work

```bash
git worktree add ../proj-feature-a feature/task-creation
git worktree add ../proj-feature-b feature/user-settings
git worktree remove ../proj-feature-a    # when finished
```

Each directory has its own branch, so several agents or experiments can run in parallel without switching branches, and a failed experiment is deleted without loss.

## Save-Point Pattern

After each change: tests pass means commit and continue; tests fail means revert to the last commit and investigate. You never lose more than one increment. Reset to the last commit only when you are sure the uncommitted work is disposable.

## Change Summaries

After any modification, report:

```
CHANGES MADE:
- src/routes/tasks.ts: added validation middleware to POST
THINGS I DID NOT TOUCH:
- src/routes/auth.ts: similar gap, out of scope
POTENTIAL CONCERNS:
- schema is strict and rejects extra fields; confirm intended
```

The "did not touch" section shows scope discipline and surfaces unintended changes.

## Pre-Commit Hygiene

```bash
git diff --staged                      # review what you are committing
git diff --staged -i -G'password|secret|api_key|token' --name-only   # any output: inspect
# then the repository's test, lint and type-check commands
```

Automate with hooks (a staged-files linter runner is typical). Commit generated files only when the project expects them (lockfiles, migrations). Do not commit build output, `.env` files or personal IDE config. Keep a `.gitignore` covering dependencies, build output, env files and key files.

## Git for Debugging

```bash
git bisect start; git bisect bad HEAD; git bisect good <known-good>   # find the culprit
git log --oneline -20          # recent history
git blame <file>               # last change per line
git log --grep="keyword" --oneline
```

## Releases and Versioning

A version number and changelog are what consumers use to decide whether upgrading is safe, once anything else depends on your code.

**Semantic versioning.** MAJOR for breaking changes, MINOR for backward-compatible additions, PATCH for backward-compatible fixes. The number is a promise: a "patch" that changes behaviour consumers relied on is a major change (see harness-build:api-and-interface-design). When unsure, assume breaking.

**Tag and derive.** A release is an immutable point, not a moving branch.

```bash
git tag -a v1.4.0 -m "Release 1.4.0" && git push origin v1.4.0
```

Derive the version from the tag instead of hand-editing it in several files, so artifact, tag and changelog agree.

**Changelog for humans.** Not `git log`: curated, newest first, grouped as Added, Changed, Fixed, Deprecated, Removed, Security, each entry phrased as user impact. Write the entry in the same change that causes it, while the impact is fresh. Breaking changes need a migration note and deprecation window (harness-ship:deprecation-and-migration). Performing the release itself belongs to harness-ship:shipping-and-launch.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll commit when it's done" | A giant commit cannot be reviewed or reverted. |
| "Messages don't matter" | They are the documentation future readers need. |
| "I'll squash it all later" | That erases the development narrative. |
| "Branches are overhead" | Short ones are free; long ones are the problem. |
| "I'll split this later" | Split before submitting. |
| "No .gitignore needed" | Until a secrets file gets committed. |
| "Small fix, bump the patch" | If consumers can observe the change, it may be major. |
| "Changelog equals commit log" | Commits are for you; the changelog is for consumers. |
| "Write the changelog at release time" | Impact is half-forgotten by then. |

## Red Flags

- Large uncommitted changes
- Messages like "fix", "update", "misc"
- Formatting mixed with behaviour
- No `.gitignore`; dependencies, env files or build output committed
- Long-lived diverging branches
- Force-pushing to shared branches
- Breaking change under a minor or patch bump
- Release with no tag, or version hand-edited out of sync with the tag
- User-facing release with no changelog entry, or one that is a commit dump

## Verification

Each commit:

- [ ] One logical change; message explains why and follows type convention
- [ ] Tests passed before committing
- [ ] No secrets in the diff
- [ ] No formatting-only noise mixed with behaviour
- [ ] `.gitignore` covers standard exclusions

Each release:

- [ ] Version bump matches the change (breaking, additive, fix)
- [ ] Tagged, with the version derived from the tag
- [ ] Changelog has a curated entry for this version
