---
name: cost-review
description: Estimates, reviews and caps the money a change can spend, covering cost estimates before building, anomaly review, budgets with hard ceilings, approval for new recurring or open-ended spend, and guards against runaway loops. Use when adding calls to a billed API or cloud service, scheduled jobs, always-on processes, polling, data scans, or investigating a cost spike.
---

# Cost Review

## Overview

Cost is a production property, like latency. A bug that loops against a billed service can spend more in a day than a feature earns in a month, and nobody notices until the invoice. Estimate before building, bound what can be spent with technical ceilings rather than good intentions, get approval for new recurring or open-ended spend, and watch for anomalies after shipping.

## When to Use

- Adding calls to a paid API, model provider, warehouse query, storage or egress.
- Adding a scheduled job, polling loop, always-on process or retry mechanism.
- Shortening a polling interval, widening a scan, or raising a limit.
- Reviewing a cost spike or a budget alert.

Not for:
- Throughput or latency tuning: use harness-verify:performance-optimization.
- Business pricing or procurement decisions.

## Process

### 1. Estimate before you build

For any change that touches billed resources, write a short estimate in the plan or pull request:

```
COST ESTIMATE
Resource:        <what is billed and the billing unit>
Unit price:      <from the provider's current price list; cite it>
Volume:          <calls, bytes, hours per day, with the assumption>
Expected/day:    <volume x price>
Worst case/day:  <what a bug or loop could cost; see step 3>
Ceiling:         <the hard cap and where it is enforced>
```

State assumptions and unknowns plainly. If you cannot find a price or volume, say so; do not guess a number and present it as fact.

### 2. Get approval for new spend

A change that introduces a **new recurring or open-ended cost** needs explicit approval from whoever owns the budget before the code ships. Examples: a new always-on process, a new scheduled job against a billed service, a tighter polling interval, a new model-provider dependency, a wider data scan. Include the estimate and ceiling in the request. Approval is per change; earlier approval does not cover a later, bigger version.

Any change whose expected or worst-case cost could approach the owner's budget on its own needs approval before it is written, not after.

### 3. Build in hard ceilings

Intent does not stop a runaway; a ceiling does. Prefer designs where the maximum spend is technically bounded:

- **Provider-side quota or budget cap** on the account or project, independent of application code.
- **Per-process and per-day limits** on calls, tokens, rows or bytes, enforced in code and failing closed.
- **Caching** of results with a defined lifetime, so repeated requests do not repeat the bill.
- **Narrow queries**: filter by partition, date range or key so scan size is bounded; check the billed bytes for a representative query before scheduling it.
- **Conservative schedules**: once a day rather than every minute unless the need is proven.
- **Retry and loop guards**: capped attempts, exponential backoff with jitter, a circuit breaker, and idempotency so a retry does not duplicate work. Never allow unbounded retries or a loop whose exit depends on external data being well-formed.
- **Kill switch**: one flag or setting that stops the job without a deploy.
- **Dry run first**: run against a small sample or a dry-run mode and measure real usage before widening.

### 4. Review after shipping

- Record the expected daily cost with the change and compare against actual after the first day and first week.
- Alert on spend anomalies and on budget thresholds (for example 50% and 90% of the daily or monthly cap). Note that an alert notifies; only a quota or cap blocks.
- When investigating a spike: identify the resource and time window, correlate with deploys and schedule changes, check for loops, retries and unfiltered scans, stop the source first (kill switch, disable job), then analyse (see harness-operate:incident-response-and-postmortem).
- After an incident, add the missing ceiling and record the lesson.

### 5. Periodic review

List recurring spend, owner and justification. Remove idle always-on resources, orphaned jobs and unused keys. Re-check that ceilings still match current budgets.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It is only a small call." | Small calls multiplied by a loop or a schedule are how large bills happen. |
| "We will watch the bill." | Billing data lags. Bound the spend technically instead. |
| "A budget alert is enough." | Alerts notify; they do not stop spending. Add a cap. |
| "Retries make it robust." | Unbounded retries against a billed service turn failure into cost. |
| "We can ask for approval later." | After the bill it is too late. Approval comes before the code. |
| "Scan the whole table, it is simpler." | Billed bytes scale with the scan. Filter by partition or range. |

## Red Flags

- No estimate attached to a change that calls a billed service.
- Polling or schedules shortened with no cost reasoning.
- Queries with no partition, date or row filter against a billed warehouse.
- Retry or loop logic with no cap or backoff.
- No provider-side quota; protection relies only on application code.
- Cost spike with no recent record of who approved the spend.
- A kill switch that requires a deploy.

## Verification

- [ ] A cost estimate (resource, price source, volume, expected and worst case per day) is recorded.
- [ ] New recurring or open-ended spend has explicit approval from the budget owner.
- [ ] A hard ceiling exists and is enforced outside the code path it protects where possible.
- [ ] Queries are bounded and checked for billed size; results are cached where repeat calls are possible.
- [ ] Retries and loops are capped with backoff; a kill switch exists.
- [ ] Spend alerts are configured and actual cost was compared with the estimate after release.

## Integration points (future)

A platform integration could supply, in neutral terms:
- Cost data per service, environment and resource, with daily granularity.
- Budget definitions, thresholds and current consumption.
- Anomaly detection results and cost recommendations.
- An approval record linking a change to its estimate and the approver.
