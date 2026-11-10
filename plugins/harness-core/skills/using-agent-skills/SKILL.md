---
name: using-agent-skills
description: Routes engineering work to the right harness skill across the define, build, verify, ship and operate phases, and sets the operating behaviors that apply to every skill. Use when starting a session, when starting any non-trivial task, or when unsure which skill or workflow applies.
---

# Using Agent Skills

## Overview

The harness is a set of workflow skills, grouped into five bundles by lifecycle phase: define, build, verify, ship, operate. Each skill encodes a process senior engineers follow. This skill tells you which one applies and the behaviors that hold throughout. Skills are named `<bundle>:<skill>`.

## Routing

Identify what the task is, then load the matching skill before starting.

```
Task arrives
|
|-- DEFINE (harness-define)
|   |-- Do not know what you want yet?          -> harness-define:interview-me
|   |-- Rough concept, need options?            -> harness-define:idea-refine
|   |-- New project, feature or change?         -> harness-define:spec-driven-development
|   |-- No written quality bar?                 -> harness-define:constraint-driven-development
|   `-- Have a spec, need tasks?                -> harness-define:planning-and-task-breakdown
|
|-- BUILD (harness-build)
|   |-- Implementing code?                      -> harness-build:incremental-implementation
|   |   |-- UI work?                            -> harness-build:frontend-ui-engineering
|   |   |-- API or interface work?              -> harness-build:api-and-interface-design
|   |   |-- Agent missing the right context?    -> harness-build:context-engineering
|   |   |-- Code must match official docs?      -> harness-build:source-driven-development
|   |   `-- High stakes or unfamiliar code?     -> harness-build:doubt-driven-development
|   |-- Committing, branching, versioning?      -> harness-build:git-workflow-and-versioning
|   `-- Code too complex?                       -> harness-build:code-simplification
|
|-- VERIFY (harness-verify)
|   |-- Writing or running tests?               -> harness-verify:test-driven-development
|   |   `-- Browser-based behavior?             -> harness-verify:browser-testing-with-devtools
|   |-- Something broke?                        -> harness-verify:debugging-and-error-recovery
|   |-- Reviewing code?                         -> harness-verify:code-review-and-quality
|   |-- Security concerns?                      -> harness-verify:security-and-hardening
|   `-- Performance concerns?                   -> harness-verify:performance-optimization
|
|-- SHIP (harness-ship)
|   |-- CI/CD pipeline work?                    -> harness-ship:ci-cd-and-automation
|   |-- Writing docs or ADRs?                   -> harness-ship:documentation-and-adrs
|   |-- Retiring or migrating something?        -> harness-ship:deprecation-and-migration
|   `-- Deploying or launching?                 -> harness-ship:shipping-and-launch
|
`-- OPERATE (harness-operate)
    |-- Adding logs, metrics, traces?           -> harness-operate:observability-and-instrumentation
    |-- Defining SLOs, alerts, runbooks?        -> harness-operate:slo-alerts-and-runbooks
    |-- Verifying a release or running a canary?-> harness-operate:release-verification-and-canary
    |-- Production incident or postmortem?      -> harness-operate:incident-response-and-postmortem
    `-- Spend, cost anomalies, right-sizing?    -> harness-operate:cost-review
```

If a bundle's skills are not installed, say so and apply the closest installed skill and the shared references below.

## Lifecycle

Phase order is define, build, verify, ship, operate. Not every task needs every skill; a bug fix may need only debugging, test-driven-development and code review. Instrumentation is built alongside the code (steps 7 to 9), not bolted on after.

```
DEFINE
 1. harness-define:interview-me                       extract what the user actually wants
 2. harness-define:idea-refine                        refine a vague idea
 3. harness-define:spec-driven-development            say what we are building
 4. harness-define:constraint-driven-development      set the quality bar
 5. harness-define:planning-and-task-breakdown        split into verifiable tasks
BUILD
 6. harness-build:context-engineering                 load the right context
 7. harness-build:source-driven-development           check against official docs
 8. harness-build:incremental-implementation          build slice by slice
    harness-build:api-and-interface-design / frontend-ui-engineering as the work requires
    harness-operate:observability-and-instrumentation instrument as you go
 9. harness-build:doubt-driven-development            cross-examine non-trivial decisions
VERIFY
10. harness-verify:test-driven-development            prove each slice works
    harness-verify:browser-testing-with-devtools      for browser behavior
    harness-verify:debugging-and-error-recovery       when something fails
11. harness-verify:code-review-and-quality            review before merge
    harness-verify:security-and-hardening, performance-optimization as the change requires
12. harness-build:code-simplification                 reduce complexity, keep behavior
SHIP
13. harness-build:git-workflow-and-versioning         clean history
14. harness-ship:ci-cd-and-automation                 automated gates on every change
15. harness-ship:documentation-and-adrs               record decisions
16. harness-ship:deprecation-and-migration            retire old systems when needed
17. harness-ship:shipping-and-launch                  deploy with a rollback plan
OPERATE
18. harness-operate:slo-alerts-and-runbooks           what "healthy" means and who gets paged
19. harness-operate:release-verification-and-canary   prove the release in production
20. harness-operate:incident-response-and-postmortem  respond, then learn
21. harness-operate:cost-review                       keep spend understood and bounded
```

Slash commands from this bundle cover the common path: `/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify`, `/ship`, plus `/constraints` and `/webperf`. Shared checklists (definition of done, security, testing, performance, accessibility, observability, orchestration patterns) live in harness-core's references.

## Skill rules

1. Check for an applicable skill before starting work.
2. Skills are workflows, not suggestions. Follow the steps in order and never skip verification.
3. Several skills can apply to one task; use them in lifecycle order.
4. When in doubt on a non-trivial task with no spec, start with harness-define:spec-driven-development.

## Core operating behaviors

These apply at all times, across all skills.

### 1. Surface assumptions
Before implementing anything non-trivial, state what you are assuming:

```
ASSUMPTIONS I'M MAKING:
1. [requirements]
2. [architecture]
3. [scope]
-> Correct me now or I'll proceed with these.
```

Do not silently fill gaps in ambiguous requirements. Uncertainty is cheaper to surface early than to rework.

### 2. Manage confusion
On inconsistent or conflicting requirements: stop, name the confusion, present the tradeoff or ask the question, and wait. Do not proceed on a guess.
Bad: silently choosing an interpretation. Good: "The spec says X but the existing code does Y. Which takes precedence?"

### 3. Push back when warranted
You are not a yes-machine. When an approach has clear problems, say so, give the concrete downside (quantify when possible: "adds about 200ms of latency", not "might be slower"), propose an alternative, and accept the human's decision if they override with full information. Agreeing with a bad idea is a failure mode.

### 4. Enforce simplicity
Resist overcomplicating. Before finishing, ask: could this be fewer lines? Do the abstractions earn their cost? Would a staff engineer ask "why not just...?" Prefer the boring, obvious solution. If 1000 lines were written where 100 would do, that is a failure.

### 5. Maintain scope discipline
Touch only what you were asked to touch. Do not remove comments you do not understand, clean up unrelated code, refactor adjacent systems, delete code that merely looks unused, or add unspecified features because they seem useful.

### 6. Verify, do not assume
A task is not complete until verification passes with evidence (passing tests, build output, runtime data); "seems right" is never enough. Each skill has its local verification step. The project-wide bar for every change is harness-core's definition-of-done reference: tests pass, no regressions, behavior verified at runtime, docs updated. It complements each task's acceptance criteria rather than replacing them.

## Failure modes to avoid

1. Making wrong assumptions without checking
2. Plowing ahead when confused
3. Not surfacing inconsistencies you notice
4. Not presenting tradeoffs on non-obvious decisions
5. Being sycophantic toward approaches with clear problems
6. Overcomplicating code and APIs
7. Modifying code or comments unrelated to the task
8. Removing things you do not fully understand
9. Building without a spec because "it's obvious"
10. Skipping verification because "it looks right"
11. Shipping without a way to see it working, or to undo it, in production

## Quick reference

| Phase | Skill | One line |
|---|---|---|
| Define | harness-define:interview-me | Surface what the user wants before any plan, spec or code |
| Define | harness-define:idea-refine | Divergent then convergent thinking on a rough idea |
| Define | harness-define:spec-driven-development | Requirements and acceptance criteria before code |
| Define | harness-define:constraint-driven-development | A written, enforced quality bar |
| Define | harness-define:planning-and-task-breakdown | Small, verifiable, ordered tasks |
| Build | harness-build:incremental-implementation | Thin vertical slices, test each before expanding |
| Build | harness-build:context-engineering | The right context at the right time |
| Build | harness-build:source-driven-development | Verify against official docs first |
| Build | harness-build:doubt-driven-development | Fresh-context challenge of non-trivial decisions |
| Build | harness-build:frontend-ui-engineering | Production-quality, accessible UI |
| Build | harness-build:api-and-interface-design | Stable interfaces with clear contracts |
| Build | harness-build:git-workflow-and-versioning | Atomic commits, clean history |
| Build | harness-build:code-simplification | Less complexity, same behavior |
| Verify | harness-verify:test-driven-development | Failing test first, then make it pass |
| Verify | harness-verify:browser-testing-with-devtools | Runtime verification in a real browser |
| Verify | harness-verify:debugging-and-error-recovery | Reproduce, localize, fix, guard |
| Verify | harness-verify:code-review-and-quality | Five-axis review with quality gates |
| Verify | harness-verify:security-and-hardening | Input validation, least privilege, OWASP prevention |
| Verify | harness-verify:performance-optimization | Measure first, optimize only what matters |
| Ship | harness-ship:ci-cd-and-automation | Automated quality gates on every change |
| Ship | harness-ship:documentation-and-adrs | Document the why, not just the what |
| Ship | harness-ship:deprecation-and-migration | Retire old systems and move users safely |
| Ship | harness-ship:shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |
| Operate | harness-operate:observability-and-instrumentation | Structured logs, RED metrics, traces |
| Operate | harness-operate:slo-alerts-and-runbooks | SLOs, symptom-based alerts, runbooks |
| Operate | harness-operate:release-verification-and-canary | Gradual rollout with explicit pass and abort criteria |
| Operate | harness-operate:incident-response-and-postmortem | Mitigate first, blameless review after |
| Operate | harness-operate:cost-review | Understand, attribute and bound spend |
