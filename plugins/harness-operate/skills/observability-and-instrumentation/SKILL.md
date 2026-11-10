---
name: observability-and-instrumentation
description: Adds logging, metrics, tracing and alert hooks to code so production behaviour can be understood from telemetry alone. Use when building or reviewing anything that runs in production, adding I/O, retries, queues or cross-service calls, or when an incident was hard to diagnose because the data was missing.
---

# Observability and Instrumentation

## Overview

Code you cannot observe is code you cannot operate. Observability means answering "what is the system doing and why?" from the outside, using the telemetry the code emits. Write instrumentation alongside the feature, as you would tests. Without it, the first user-reported bug becomes archaeology instead of a query.

## When to Use

- Building a feature, service, endpoint, background job or external integration that will run in production.
- Reviewing a change that adds I/O, retries, queues or cross-service calls.
- A past incident ended with "we couldn't tell what happened".
- Setting up alerts (continue with harness-operate:slo-alerts-and-runbooks).

Not for:
- A failure happening right now: use harness-verify:debugging-and-error-recovery (good telemetry makes it faster).
- Measured slowness: use harness-verify:performance-optimization.
- Launch-day checks and rollback triggers: use harness-ship:shipping-and-launch and harness-operate:release-verification-and-canary.

## Process

### 1. Define "working" first

Telemetry without a question is noise. Write 2-4 questions the on-call engineer will ask:

```
FEATURE: payment retry
QUESTIONS:
1. What share of payments succeed first time vs after retry?
2. When one fails permanently, why (provider error, timeout, validation)?
3. Is the provider slower than usual?
Every signal added must help answer one of these.
```

If you cannot name the questions, you are not ready to instrument.

### 2. Choose the signal

| Signal | Answers | Cost profile |
|---|---|---|
| Structured log | What happened in this case? | Per event; grows with traffic |
| Metric | How often / how fast, in aggregate? | Per series; cheap to query |
| Trace | Where did the time go across services? | Per request; usually sampled |

Metrics say that something is wrong, traces say where, logs say why.

### 3. Structured logging

Log events, not prose: a stable event name plus machine-readable fields.

```
BAD:  log("Payment 42 failed for user 7 after 3 retries")
GOOD: log.warn({event: "payment_failed", paymentId: 42, provider: "x",
                errorCode: "timeout", attempt: 3})
```

| Level | Meaning | On-call action |
|---|---|---|
| error | Invariant broken; someone may need to act | Investigate |
| warn | Degraded but handled (retry succeeded, fallback used) | Watch trends |
| info | Significant business event | None |
| debug | Diagnostic detail | Off in production by default |

**Correlation IDs are mandatory.** Accept or generate a request ID at the system boundary; attach it to every log line, span and outbound call (headers, queue metadata). Without it a single request cannot be reconstructed from interleaved logs.

**Name the entry point.** A correlation ID identifies a run, not which path started it. If a scheduler, a replay endpoint and a manual script can all start the same job into one log sink, their lines are interchangeable. Stamp an `entry_point` field where the run starts, propagate it with the correlation ID, and never infer it downstream. A field that merely correlates with an entry point is a hint, not attribution.

**Never log secrets, tokens, passwords or unredacted personal data.** Allowlist fields; do not dump request bodies. See harness-verify:security-and-hardening.

### 4. Metrics

- Request-driven code: RED on every endpoint and external dependency (Rate, Errors, Duration).
- Resources such as queues, pools and hosts: USE (Utilization, Saturation, Errors).
- Latency is a histogram; read p50/p95/p99. Never rely on averages.
- **Cardinality is the failure mode.** Each distinct label combination is a separate series. Labels come from small fixed sets (route template, status class, dependency name). Never use user IDs, raw URLs, request IDs or error text as labels; those belong in logs and traces.

```
OK label:     route="/tasks/:id"  status_class="5xx"  dependency="billing"
NEVER label:  user_id, email, request_id, full URL, error message
```

### 5. Tracing

Prefer a vendor-neutral standard (OpenTelemetry) so the backend can change. Auto-instrumentation covers HTTP, RPC and common database clients. Add manual spans only around meaningful internal units of work and attach the attributes on-call will filter by. Propagate context across every async boundary or the trace breaks at the gap. Sample at a low rate by default and keep all errors where tail sampling is available.

### 6. Alerts and runbooks (summary)

Alert on symptoms users feel (error rate, latency, queue age), not causes (CPU, one restart). Each alert must be actionable, justified by an SLO or data, and linked to a runbook. Two severities only: page and ticket. Details in harness-operate:slo-alerts-and-runbooks.

### 7. Verify the telemetry

Instrumentation is code and can be wrong. Before calling the work done:
- Force an error in a non-production environment; find it by request ID, with structured fields.
- Send test traffic; confirm series appear with expected labels and sane values.
- Follow one request across services with no broken spans.
- Fire each new alert once (temporarily lower the threshold); confirm it reaches the right channel and the runbook link works.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll add logging after it works." | "After" means after the first incident, the costliest time to find out you are blind. |
| "More logs means more observability." | Unstructured noise slows incidents down. Three queryable events beat three hundred prose lines. |
| "Plain print statements are fine for now." | They cannot be filtered, correlated or alerted on. A structured logger costs minutes once. |
| "We'll look at dashboards when something breaks." | Dashboards built without questions show everything except the answer. |
| "Alert on everything, tune later." | A noisy pager trains people to ignore it; the tuning never happens. |
| "User ID as a metric label helps debugging." | It also overwhelms the metrics backend. Use logs and traces for that. |
| "Tracing is overkill for two services." | Two services already raise cross-service latency questions logs cannot answer. |

## Red Flags

- A change with retries, queues or external calls and no new telemetry.
- Log lines built by string interpolation; no correlation ID.
- One log sink fed by several entry points with no field naming which.
- Labels holding user IDs, URLs or error text; latency tracked only as an average.
- Alerts that fire daily and are acknowledged without action; paging on CPU while user-facing errors are unmonitored.
- Secrets or full request bodies in logs.
- "Works on my machine" as the only evidence of production health.

## Verification

- [ ] On-call questions are written down and each signal maps to one.
- [ ] Logs are structured with stable event names and a correlation ID on every line.
- [ ] Sinks written by multiple entry points carry an entry-point field set at the start of the run.
- [ ] Actual output spot-checked: no secrets or unredacted personal data.
- [ ] RED metrics exist for each new endpoint and dependency with bounded labels; latency is a histogram.
- [ ] One request can be followed end to end without broken spans.
- [ ] Each new alert is symptom-based, has a runbook link and was test-fired.
- [ ] An induced failure was located from telemetry alone, without reading source.

For a shorter list, see harness-core's observability checklist reference.
