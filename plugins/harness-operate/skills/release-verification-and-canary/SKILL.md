---
name: release-verification-and-canary
description: Verifies a deployment after it ships and rolls it out progressively, covering post-deploy checks, canary criteria, automatic rollback triggers, bake time and the evidence to record. Use when deploying to production or any shared environment, planning a staged rollout, or deciding whether a release is healthy enough to widen or must be rolled back.
---

# Release Verification and Canary

## Overview

A deploy is not done when the pipeline turns green; it is done when the new version has been shown healthy under real traffic. Verify with evidence, expose change gradually so mistakes affect few users, and agree in advance what result triggers rollback. This skill covers what happens from the moment a change reaches an environment until it is accepted.

## When to Use

- Deploying to production or a shared environment.
- Planning a canary, percentage or ring-based rollout, or a feature-flag ramp.
- Deciding whether to widen, hold or roll back.
- Recording what verified a release.

Not for:
- Pre-launch readiness (tests, security, docs): use harness-ship:shipping-and-launch.
- Building the pipeline: use harness-ship:ci-cd-and-automation.
- Handling the resulting incident: use harness-operate:incident-response-and-postmortem.

## Process

### 1. Before the deploy

- Name the version, the change summary and the person responsible.
- Confirm a tested rollback path (previous version available, migrations backward compatible or separable).
- Write the success and rollback criteria down now (step 3), not after you see the graphs.
- Check the window: avoid deploying when responders are unavailable.

### 2. Progressive rollout

Expose the change in stages, with a decision at each:

| Stage | Exposure | Purpose |
|---|---|---|
| Canary | Small slice of traffic or one instance | Catch crashes and gross errors |
| Partial | Larger fraction, a ring or region | Surface load and edge cases |
| Full | All traffic | Complete rollout |

Rules:
- Compare canary against the baseline running at the same time, not against yesterday.
- The canary slice must be large enough to produce a signal in the observation period; a handful of requests proves nothing.
- Hold each stage for its **bake time** (see step 4) before widening.
- Prefer decoupling deploy from release: ship code dark behind a flag, then ramp the flag.
- Database and contract changes: expand first, migrate, contract last, so any version can run against the schema.

### 3. Criteria and rollback triggers

Define thresholds in advance, using SLO and baseline data (see harness-operate:slo-alerts-and-runbooks):

```
PROCEED if, for the full bake window:
  error rate not worse than baseline by more than X
  p95/p99 latency within Y of baseline
  no new error types in logs
  saturation (CPU, memory, queue age) within normal range
  key business signal (for example completed transactions) not down by more than Z
ROLL BACK IMMEDIATELY if:
  error rate or latency breaches the hard limit
  data corruption or security signal appears
  crash loops or failing health checks
  the on-call lead judges user harm is occurring
```

Automate rollback for the unambiguous triggers where the system supports it; automation is faster than a human reading a graph. Rollback on trigger is a normal outcome, not a failure. Do not argue with the thresholds after the fact.

### 4. Post-deploy verification checklist

Run after each stage:
1. Deployed version is the intended one on every instance; health checks pass.
2. Smoke test the critical user paths against the live environment (read-only or with test data).
3. Error rate, latency and saturation dashboards compared with baseline.
4. Logs scanned for new errors and warnings by event name (see harness-operate:observability-and-instrumentation).
5. Background jobs, queues and scheduled tasks are running and draining.
6. Dependencies and downstream consumers are healthy.
7. Migrations applied and data checks pass.
8. Configuration and secrets resolved; no fallback defaults in use.
9. Alerts quiet, and not silenced to make them quiet.

**Bake time**: hold long enough to cover a representative traffic pattern and at least one cycle of any periodic job. Longer for riskier changes. Nobody should leave the change unwatched during bake.

### 5. Decide and record

Outcome is one of: widen, hold, roll back, or accept. Record as evidence:
- Version, environment, time, deployer and approver.
- The stage reached and exposure at each stage.
- The criteria and the measured values (links or snapshots of the graphs).
- Smoke test results and any anomalies observed.
- Decision and reason; for a rollback, the trigger and the follow-up.

After acceptance, remove temporary flags and canary scaffolding, and keep watching through the next normal peak.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The pipeline passed, so it is fine." | Tests do not see production traffic or data. |
| "Canary is overkill for a small change." | Small changes cause large outages. Staging is cheap. |
| "We will pick thresholds once we see the graphs." | Thresholds chosen afterwards rationalise whatever happened. |
| "Rolling back makes us look bad." | Fast rollback limits damage. Slow rollback is what hurts. |
| "Five minutes of watching is enough." | Many faults appear only under peak load or on a scheduled run. |
| "We silenced that alert, it was noisy." | Silencing during a rollout hides the signal you need. |

## Red Flags

- No rollback path, or one that was never tested.
- Canary compared with last week rather than concurrent baseline.
- Canary too small to produce data.
- Widening to full immediately after deploy; no bake period.
- Success criteria written after the rollout began.
- Alerts muted during the release.
- No record of what evidence supported accepting the release.

## Verification

- [ ] Success and rollback criteria were written before the deploy, with thresholds.
- [ ] A tested rollback path exists; schema changes are compatible across versions.
- [ ] Rollout was staged, with each stage compared with a concurrent baseline.
- [ ] Each stage held for its bake time before widening.
- [ ] The post-deploy checklist was completed and smoke tests passed.
- [ ] Automatic or immediate rollback triggers were honoured if hit.
- [ ] Evidence (version, stages, measurements, decision) is recorded.

## Integration points (future)

A platform integration could supply, in neutral terms:
- Release status per environment, with version history and one-step rollback.
- Progressive rollout controls and traffic-split state.
- Health, error and latency data compared against a baseline.
- A release record storing criteria, measurements, approvals and the final decision.
