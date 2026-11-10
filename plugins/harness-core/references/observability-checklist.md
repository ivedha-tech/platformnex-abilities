# Observability Checklist (reference)

A quick reference for instrumenting production code.

## Start here: on-call questions

Telemetry without a question is noise.

- [ ] 2-4 questions an on-call engineer will ask about this feature are written down
- [ ] Every signal below maps to one of those questions
- [ ] Each question uses the right signal: metrics say that something is wrong, traces say where, logs say why

## Structured logging

- [ ] Structured (JSON) logs with stable event names, not free-form strings
- [ ] Every line carries a correlation or request ID, created or accepted at the system boundary
- [ ] The ID propagates on every outbound call and async boundary (HTTP headers, queue metadata)
- [ ] A log stream written by several entry points (scheduler, replay, manual run) carries an entry-point field set where the run starts
- [ ] Consistent levels: error = invariant broken and someone may act; warn = degraded but handled; info = significant business event; debug = off in production
- [ ] No secrets, tokens, passwords or unredacted PII in any line
- [ ] Fields are allowlisted; no whole request or response bodies, no auth headers
- [ ] External calls logged as metadata only: endpoint, status, latency, attempt count, sanitized identifiers
- [ ] Real output spot-checked: structured fields, not `[object Object]`

## Metrics

- [ ] RED for every endpoint and external dependency: Rate, Errors, Duration
- [ ] USE for every resource (queues, pools, hosts): Utilization, Saturation, Errors
- [ ] Latency is a histogram with p50/p95/p99 queryable, never an average
- [ ] Labels come from small fixed sets (route template, status class, provider name)
- [ ] No unbounded label values: user or tenant IDs, emails, raw URLs, request IDs, error text
- [ ] Status codes grouped by class (5xx, not 503)
- [ ] Queue depth and processing time tracked for every worker or queue

## Distributed tracing

- [ ] Tracing (OpenTelemetry or equivalent) initialized at startup, before other imports
- [ ] Auto-instrumentation on for HTTP, gRPC and database clients
- [ ] Trace context (W3C `traceparent`/`tracestate`) sent on every outbound call and extracted from every inbound request
- [ ] Context survives async boundaries; queue messages carry trace metadata
- [ ] Manual spans only around meaningful internal work, with the attributes on-call will filter by
- [ ] No secrets or PII in span attributes
- [ ] Low default head sampling; keep 100% of errors if tail sampling exists

## Alerting

- [ ] Alerts are symptom-based (error rate, p99 latency, queue age); causes (CPU, disk, restarts) go on dashboards, not pagers
- [ ] Every alert is actionable; "ignore, it self-heals" alerts are deleted
- [ ] Every alert links to a runbook of at least three lines: what it means, first query, escalation path
- [ ] Thresholds and durations justified by an SLO or history, not guesses
- [ ] Two severities: page (user-facing, act now) and ticket (degradation, act this week)
- [ ] Each new alert test-fired once, reached the right channel, runbook link works
- [ ] No alert fires daily and gets acknowledged without action

## Dashboards

- [ ] Service health dashboard: error rate, p99 latency, traffic, saturation
- [ ] Dependency panel with per-service error rate and latency
- [ ] The dashboard answers the on-call questions above
- [ ] Sensible default range (1h-6h, not 30d)

## Verify the telemetry

Instrumentation is code and can be wrong.

- [ ] Forced an error in staging and found it in logs by correlation ID
- [ ] Sent test traffic; metric series appear with expected labels and sane values
- [ ] Followed one request end to end in the tracing UI with no broken spans
- [ ] Diagnosed an induced failure from telemetry alone

## Pre-launch gate

- [ ] Structured logs reach the aggregator
- [ ] RED metrics visible for every new endpoint and dependency
- [ ] At least one symptom-based alert, with runbook, test-fired
- [ ] A request can be traced across every service it touches
- [ ] On-call knows where the runbooks are
