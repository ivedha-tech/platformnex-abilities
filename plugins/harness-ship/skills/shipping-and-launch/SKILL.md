---
name: shipping-and-launch
description: Guides a production launch through a pre-launch checklist, feature-flagged staged rollout with go/hold/rollback thresholds, post-launch verification, an error-budget gate, and a written rollback plan. Use when preparing to deploy or release to production, deciding what must be in place before shipping, planning a canary, or writing a rollback plan.
---

# Shipping and Launch

## Overview

The goal is not to deploy; it is to deploy safely. A launch should be reversible, observable, and incremental: a rollback plan exists before the deploy, monitoring exists before users arrive, and success is defined before release.

## When to Use

- First production deploy of a feature
- A significant user-visible change
- Data or infrastructure migration
- Opening a beta or early-access program
- Any deploy with risk (assume all do)

Not needed for: documentation-only or comment-only changes.

## Pre-Launch Checklist

Clear the project's definition of done first (harness-core's definition-of-done reference), then confirm each area.

**Code quality**
- [ ] Tests pass at every level the project uses; build is clean
- [ ] Lint and type checks pass
- [ ] Reviewed and approved
- [ ] No unresolved TODOs or leftover debug output
- [ ] Expected failure modes are handled

**Security** (see harness-verify:security-and-hardening)
- [ ] No secrets in code or history
- [ ] Dependency audit shows no critical or high findings
- [ ] Input validation, authentication, and authorization on exposed endpoints
- [ ] Security headers set; rate limiting on authentication endpoints
- [ ] Cross-origin access limited to named origins, not a wildcard

**Performance** (see harness-verify:performance-optimization)
- [ ] Core user-facing timings within agreed thresholds
- [ ] No N+1 queries on hot paths; needed indexes exist
- [ ] Assets compressed and cached; bundle within budget

**Accessibility**
- [ ] Keyboard operable; screen reader conveys structure
- [ ] Contrast meets WCAG 2.1 AA (4.5:1 body text)
- [ ] Focus handled for dialogs and dynamic content
- [ ] Form errors are descriptive and tied to their fields

**Infrastructure**
- [ ] Production configuration set, and defined as code rather than remembered
- [ ] Migrations applied or ready, with a tested down path
- [ ] DNS, TLS, and CDN configured where relevant
- [ ] Logging and error reporting active; health check responds

**Documentation** (see harness-ship:documentation-and-adrs)
- [ ] README, API docs, and changelog current
- [ ] ADRs written for architectural decisions
- [ ] User-facing docs updated

## Feature Flag Strategy

Flags decouple deployment from release.

1. Deploy with the flag off; code is live but inactive.
2. Enable for the team or a beta group.
3. Roll out gradually (for example 5%, 25%, 50%, 100%).
4. Monitor at each step: errors, latency, user feedback.
5. Remove the flag and dead path after full rollout.

Rules: every flag has an owner and an expiry; remove within about two weeks of full rollout; do not nest flags; test both states in CI.

## Staged Rollout

1. **Staging.** Run the full suite and smoke-test critical flows.
2. **Production, flag off.** Confirm the health check and that no new errors appear.
3. **Team only.** Use it in production; watch for a day.
4. **Canary (about 5%).** Compare canary against baseline for one to two days; advance only if every threshold below is green.
5. **Gradual increase.** Repeat the same checks at each step, able to drop back to the previous percentage at any time.
6. **Full rollout.** Monitor for a week, then clean up the flag.

### Decision thresholds

| Metric | Advance | Hold and investigate | Roll back |
|---|---|---|---|
| Error rate | Within 10% of baseline | 10-100% above baseline | More than 2x baseline |
| P95 latency | Within 20% of baseline | 20-50% above | More than 50% above |
| Client-side errors | No new error types | New types on under 0.1% of sessions | New types on over 0.1% of sessions |
| Business metrics | Neutral or better | Down under 5% (may be noise) | Down over 5% |

Also roll back immediately on data-integrity problems, a discovered security vulnerability, or a spike in user reports. Adjust the numbers to the service if its baseline calls for it, but agree on them before the launch, not during it.

## What to Monitor

- **Application:** error rate (total and per endpoint), p50/p95/p99 latency, request volume, key business metrics
- **Infrastructure:** CPU and memory, connection pool use, disk, queue depth
- **Client:** user-facing load timings, script errors, API failures seen by the client

Errors must be reported to a tracking system with enough context (route, release, user or session identifier where appropriate) and the server must return a generic error body rather than internals.

## Error Budget Gate

If the service has an SLO, its remaining error budget decides the pace:

| Budget remaining | Action |
|---|---|
| More than 20% | Ship normally, watch closely |
| 0 to 20% | Slow rollouts only; no high-risk changes |
| Exhausted | Freeze feature work; spend effort on reliability |

A canary burning budget faster than baseline is a hold signal even if individual thresholds are green. Alert and SLO design: harness-operate:slo-alerts-and-runbooks.

## Post-Launch Verification (first hour)

1. Health endpoint returns success
2. No new error types in monitoring
3. Latency shows no regression
4. Critical user flow works when tried by hand
5. Logs are flowing and readable
6. Rollback path confirmed ready (dry run if possible)

For deeper release checks see harness-operate:release-verification-and-canary.

## Rollback Plan

Write it before deploying:

```markdown
## Rollback plan: <release>
### Triggers
- Error rate > 2x baseline; P95 > <X> ms; reports of <specific issue>
### Steps
1. Disable the flag, OR redeploy the previous version
2. Verify: health check, error monitoring
3. Notify the team
### Data
- Migration <X> has a tested down path: <command or runbook link>
- Data written by the new feature: preserved / cleaned up
### Expected time
- Flag: under 1 min; redeploy: under 5 min; database: under 15 min
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Works in staging, so it'll work in production" | Production has different data, traffic, and edge cases. Monitor after deploy. |
| "This doesn't need a flag" | A kill switch is cheap, and small changes break things too. |
| "Monitoring is overhead" | Without it, users tell you about problems instead of dashboards. |
| "We'll add monitoring later" | Add it before launch; you cannot debug what you cannot see. |
| "Rolling back is admitting failure" | Rolling back is the responsible move. Leaving a broken release up is the failure. |
| "Error rate looks fine, keep going" | Check burn rate too; faster-than-baseline budget use is a hold signal. |

## Red Flags

- No rollback plan
- No production monitoring or error reporting
- Big-bang releases with no staging
- Flags with no owner or expiry
- Nobody watching the first hour
- Production config done from memory
- Releasing late on a Friday with no one on call
- Error budget exhausted but feature work continues

## Verification

Before deploying:
- [ ] Pre-launch checklist complete
- [ ] Flag configured, if applicable
- [ ] Rollback plan written
- [ ] Dashboards and alerts in place
- [ ] Team informed

After deploying:
- [ ] Health check passes
- [ ] Error rate and latency normal
- [ ] Critical flow works
- [ ] Logs flowing
- [ ] Rollback confirmed ready

For every shipped service:
- [ ] An error budget policy defines actions at under 20% and at exhaustion
