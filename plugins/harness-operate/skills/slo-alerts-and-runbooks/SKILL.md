---
name: slo-alerts-and-runbooks
description: Defines service level indicators and objectives, error budgets, symptom-based alerts and on-call runbooks. Use when launching a service, setting or reviewing alerting, tuning a noisy pager, deciding how much reliability work is justified, or writing the runbook an alert links to.
---

# SLOs, Alerts and Runbooks

## Overview

Reliability is a target you choose, measure and spend, not a vague aim. An SLO states what "good enough" means for users; the error budget is the allowed shortfall; alerts fire when the budget is burning faster than acceptable; runbooks tell the responder what to do. Each piece exists to keep humans paged only when users are hurt and a human can act.

## When to Use

- A new service or user-facing feature is going to production.
- Alerts are noisy, missing real failures, or nobody knows what they mean.
- Release speed versus reliability needs an objective trade-off.
- Writing or repairing a runbook.

Not for:
- Adding the underlying telemetry: use harness-operate:observability-and-instrumentation.
- Responding to an active incident: use harness-operate:incident-response-and-postmortem.

## Process

### 1. Choose SLIs

An SLI is a measurable ratio of good events to valid events, taken from the user's point of view.

| Service type | Typical SLIs |
|---|---|
| Request/response | Availability (successful requests / valid requests), latency (requests faster than a threshold / all) |
| Pipeline or queue | Freshness (data newer than N minutes), completeness, queue age |
| Storage | Durability, read success rate |

Measure as close to the user as practical, and exclude invalid requests (client errors) from the denominator. Pick two or three SLIs; more dilutes attention.

### 2. Set SLOs

An SLO is an SLI target over a window, for example "99.9% of requests succeed over 28 days".
- Base the target on what users need and what you currently achieve, not on aspiration. Start slightly below current performance and tighten later.
- 100% is the wrong target: it forbids change and costs without bound.
- Write down who agreed to it.

### 3. Use the error budget

Budget = 1 - SLO over the window. It is what you can spend on releases, experiments and failures.
- Budget remaining: ship at normal pace.
- Budget nearly spent or exhausted: slow or pause risky releases and prioritise reliability work until it recovers. Agree this policy in advance, with the product owner.
- Review budget consumption regularly and after each incident.

### 4. Design alerts

Alert on symptoms users feel, not causes.

```
SYMPTOM (can page):             CAUSE (dashboard or ticket):
error budget burning fast       CPU at 85%
p99 latency above threshold     one instance restarted
queue age above threshold       disk at 70%
```

Prefer **burn-rate alerts**: page when the budget is being consumed fast enough to be exhausted well before the window ends. A common design pairs a short window with a long window so a brief blip does not page and a slow leak does not hide. Pick thresholds from the SLO and historical data, not guesses.

Alert quality rules:
1. Actionable: a human must do something now. If it self-heals or the answer is "ignore", delete it.
2. Linked to a runbook.
3. Two severities only: page (act now, user-facing) and ticket (act this week).
4. Owned by a team, with a clear route to the on-call.
5. Reviewed: track pages per shift, fraction actionable, and time to acknowledge. Retire or tune any alert that is mostly noise.
6. Test-fired once before it goes live.

### 5. Write runbooks

A runbook answers without requiring thought: what is happening, what to check first, how to mitigate, who to call.

Minimum form:

```
# Runbook: <alert name>
Means:      <what this alert indicates, likely causes>
Impact:     <what users experience>
First check:<one query or command and how to read it>
Mitigate:   <safe first actions, including rollback or flag off>
Escalate:   <team or role, and when>
```

- Expand only where the first check does not decide the next step. Five clear steps beat twenty skimmed ones.
- Write mitigation before diagnosis: how to stop harm fastest.
- Store runbooks in version control next to the service, named after the alert.
- Update the runbook when closing every incident that used it. A stale runbook gives false confidence.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Aim for 100% reliability." | Unreachable and it freezes delivery. Choose a target that matches user need. |
| "Alert on CPU and memory, just in case." | These fire when nothing is wrong and miss failures you did not predict. |
| "A noisy alert is better than a missed one." | Noise trains people to ignore the pager, so real pages are missed too. |
| "We will write the runbook after the first page." | The first page is when it is needed most, at 3am, by someone new. |
| "The SLO is just a number for slides." | Without a policy tied to the budget it changes nothing. |
| "Average latency is fine." | Averages hide the tail users actually feel. Use percentiles. |

## Red Flags

- No stated SLO, or a target nobody has measured against.
- Pages for CPU, memory or single-instance events.
- Alerts with no runbook, no owner, or a threshold nobody can justify.
- Pager acknowledged and closed without action, repeatedly.
- Error budget exhausted with no change in release behaviour.
- Runbooks that are walls of text, out of date, or lack a mitigation step.

## Verification

- [ ] Each user-facing service has 2-3 SLIs and a written SLO with an agreed window.
- [ ] An error budget policy states what changes when budget runs low.
- [ ] Paging alerts are symptom-based (preferably burn-rate) with thresholds justified by the SLO or data.
- [ ] Every alert has an owner, one of two severities, a runbook link, and was test-fired.
- [ ] Each runbook states meaning, impact, first check, mitigation and escalation.
- [ ] Alert noise is reviewed on a schedule and tuned or retired.

## Integration points (future)

A platform integration could supply, in neutral terms:
- Alert policies and their current state, with ownership.
- SLO definitions and live error budget status per service.
- Service ownership, on-call schedules and escalation paths.
- A place to store and surface runbooks alongside the service record.
