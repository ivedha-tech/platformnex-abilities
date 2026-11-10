---
name: ci-cd-and-automation
description: Designs and maintains CI/CD pipelines so every change passes automated quality gates before merge and deploys reversibly. Use when setting up or changing build and deployment pipelines, wiring test runners into CI, choosing a rollout or rollback mechanism, or diagnosing and speeding up a failing or slow pipeline.
---

# CI/CD and Automation

## Overview

CI is the enforcement layer for every other practice in the harness. People and agents miss things; a pipeline that runs the same checks on every change does not. Two principles drive the design:

- **Shift left.** Run cheap, fast checks first (format, lint, types) and expensive ones later (integration, end-to-end). A defect found by a linter costs minutes; the same defect found in production costs hours.
- **Smaller batches are safer.** A release with three changes is easy to diagnose; one with thirty is not. Frequent small releases also exercise the release process itself until it is boring.

## When to Use

- Starting a project, or a project with no pipeline
- Adding, removing, or reordering automated checks
- Configuring deploys, environments, secrets, or rollback
- Debugging a red or slow pipeline

Not for: one-off local scripts that never gate a merge or deploy.

## The Gate Sequence

Order gates from fastest to slowest, and stop at the first failure:

1. Format and lint
2. Type check or static analysis
3. Unit tests
4. Build
5. Integration tests (real database or service containers, disposable)
6. End-to-end tests (only for flows that need a real browser or full stack)
7. Dependency and secret scanning
8. Size or performance budgets, where the project has them

**No gate may be bypassed.** A failing lint rule gets fixed, not disabled. A failing test gets fixed or deleted with justification, not skipped to turn the pipeline green.

## Pipeline Design Rules

- Trigger on every pull request and every push to the main branch.
- Make the checks required in branch protection so a red pipeline blocks merge. Disallow force-pushes to the main branch.
- Install from the lockfile with a clean-install command so builds are reproducible.
- Pin tool and runtime versions; do not use floating "latest".
- Keep jobs independent where possible so they run in parallel and fail separately.
- Upload test reports and failure artifacts (logs, screenshots) so a failure is diagnosable without rerunning.

Sketch of a parallel layout (syntax varies by CI system):

```yaml
jobs:
  lint:       { steps: [checkout, setup-runtime-with-cache, clean-install, run lint] }
  typecheck:  { steps: [checkout, setup-runtime-with-cache, clean-install, run typecheck] }
  test:       { steps: [checkout, setup-runtime-with-cache, clean-install, run tests with coverage] }
  build:      { needs: [lint, typecheck, test], steps: [checkout, clean-install, run build] }
```

### Integration tests with a database

Start the database as a disposable service container, apply migrations, then run the suite against it. Supply credentials from the CI secret store even for a throwaway database; it keeps a habit that prevents test credentials leaking into real configuration.

## Using CI Failures in the Loop

When a pipeline fails, give the exact failing output to whoever fixes it (human or agent) and require a local reproduction before pushing again.

| Failure | Response |
|---|---|
| Lint or format | Run the auto-fixer locally, review the diff, commit |
| Type or compile error | Go to the reported location and fix the cause, not the symptom |
| Test failure | Follow harness-verify:debugging-and-error-recovery |
| Build or dependency error | Check configuration, lockfile, and tool versions |
| Flaky test | Treat as a bug; quarantine with an owner and a deadline, never "just rerun" |

## Deployment Practices

### Preview environments
Give each pull request an ephemeral environment when feasible, so reviewers can exercise the change. Tear it down on merge or close.

### Feature flags
Flags separate deploying code from releasing behavior. They let you merge early, disable without redeploying, expose a change to a small percentage first, and compare behavior with and without it.

```typescript
if (flags.isEnabled('new-checkout', { userId })) return renderNewCheckout();
return renderLegacyCheckout();
```

Lifecycle: create, enable for testing, canary, full rollout, then remove the flag and the dead branch. Record an owner and a removal date at creation; flags that never die become debt. Test both states in CI.

### Staged promotion
Merge to main, deploy to staging automatically, verify, then promote to production (manual or automatic after checks). Watch error and latency signals for a defined window after promotion; on regression, roll back first and investigate second.

### Rollback
Every deploy must be reversible by a single, rehearsed action: redeploy a previous version, or flip a flag. If a manual rollback workflow takes a version input, pass the input through an environment variable rather than interpolating it into the shell script, to avoid command injection.

## Environments and Secrets

- Commit a template of required variables (names only, no values).
- Never commit real local environment files.
- CI uses its own secrets; it never holds production secrets.
- Production secrets live in the platform's secret manager, not in repository files or pipeline definitions.

## Automation Around the Pipeline

- **Dependency updates:** use an automated updater on a weekly schedule with a cap on open pull requests, and let CI vet each update.
- **Build owner:** name someone responsible for keeping the main branch green. When it breaks, the owner reverts or fixes first; the author helps after. This stops broken builds from piling up on the assumption that someone else will handle it.
- **Merge policy:** at least one approving review, required status checks, and optional auto-merge when both are satisfied.

## Keeping the Pipeline Fast

If the core test path exceeds about 10 minutes, apply in this order:

1. Cache the package manager's download cache (not installed modules).
2. Run independent jobs in parallel.
3. Use path filters so unrelated changes skip irrelevant jobs (for example, skip browser tests for docs-only changes).
4. Shard large test suites across runners.
5. Move slow, low-value tests off the critical path onto a schedule.
6. Use larger runners only after the above.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "CI is too slow" | Optimize it; do not skip it. A few minutes of CI prevents hours of debugging. |
| "This change is trivial, skip CI" | Trivial changes break builds too, and CI is quick for them. |
| "The test is flaky, just rerun" | Reruns hide real defects and train people to ignore red. Fix or quarantine with an owner. |
| "We'll add CI later" | Unguarded projects drift into broken states. Add it on day one. |
| "Manual testing is enough" | It is not repeatable and does not scale. |

## Red Flags

- No pipeline, or one that nobody looks at
- Tests or rules disabled to get green
- Production deploys that skip staging
- No rollback path, or one never rehearsed
- Secrets in code or pipeline files
- Pipeline times growing with no optimization effort

## Verification

- [ ] Gates present: lint, types, tests, build, dependency audit
- [ ] Runs on every pull request and every push to main
- [ ] Failures block merge via branch protection
- [ ] Secrets come from a secret store, never from files
- [ ] Deploys have a documented, rehearsed rollback
- [ ] Failure output and artifacts are available for diagnosis
- [ ] Core test path completes in roughly 10 minutes or less
