---
name: incident-response-and-postmortem
description: Guides handling of a production incident from triage through mitigation, communication, rollback decision and a blameless postmortem with tracked follow-ups. Use when an alert fires, users report an outage or degradation, a release misbehaves in production, or after an incident when a postmortem is due.
---

# Incident Response and Postmortem

## Overview

During an incident the goal is to restore service, not to find the culprit. Stop the harm first, understand it second, learn from it third. Good response is mostly discipline: clear roles, honest severity, steady communication, reversible actions, and a written record that turns pain into lasting fixes.

## When to Use

- An alert pages, or users report errors, slowness or data problems.
- A recent release correlates with a change in behaviour.
- An incident has been resolved and the postmortem is due.

Not for:
- Debugging a defect in development: use harness-verify:debugging-and-error-recovery.
- Designing the alerts and runbooks themselves: use harness-operate:slo-alerts-and-runbooks.

## Process

### 1. Triage (first minutes)

1. Confirm it is real: check the user-facing symptom, not only the alert.
2. Declare the incident and name an **incident lead**. One person coordinates; others investigate or communicate.
3. Assign severity from impact, not from guessed cause:

| Severity | Impact | Response |
|---|---|---|
| Sev1 | Core function down or data at risk for many users | Everyone needed, continuous updates |
| Sev2 | Major feature degraded or a subset badly affected | Active response, regular updates |
| Sev3 | Minor degradation, workaround exists | Handle in business hours, ticket |

When unsure, pick the higher severity and downgrade later.
4. Open a single place for the timeline (channel or document). Record actions with timestamps as you go.

### 2. Communicate

- Post an initial note quickly: what users see, severity, who leads, when the next update is due.
- Update on the promised cadence even when nothing has changed ("still investigating, next update at HH:MM").
- Keep investigation chatter out of the stakeholder channel.
- State facts and unknowns separately. Never speculate about cause to stakeholders.

### 3. Mitigate before root cause

Choose the fastest safe action that reduces user harm: roll back, disable a feature flag, shed load, fail over, scale out, restore from backup. Understanding why can wait.

**Rollback decision.** Roll back when all hold: a recent change plausibly explains the symptom, rollback is tested and reversible, and it does not cause data loss (check migrations and queued work). Do not wait for proof; "when in doubt, roll back" beats "let us investigate live". If rollback is unsafe (irreversible migration), say so and prefer a forward fix behind a flag.

Rules for any mitigation:
- One change at a time, recorded in the timeline, with the expected effect stated first.
- Prefer reversible actions. Confirm the symptom metric actually recovered, not just that the action ran.
- Do not make unreviewed ad hoc changes to production without the lead's agreement.

### 4. Diagnose

Once harm is contained, find the cause using telemetry (see harness-operate:observability-and-instrumentation): recent changes, dependency health, saturation, error breakdown by request ID. Form hypotheses, test the cheapest first, and write down what was ruled out. Escalate early to whoever owns the failing component.

### 5. Resolve and hand off

Resolved means the user-facing symptom is gone and stable for an agreed bake period (see harness-operate:release-verification-and-canary), not that the cause is understood. Announce resolution, note any remaining risk, and schedule the postmortem (within a few working days while memory is fresh).

### 6. Blameless postmortem

Write it for learning, not for fault. Ask "how did our system allow a reasonable person to do this?", never "who did this?".

Contents:
- **Summary**: what happened, impact (duration, users, data), severity.
- **Timeline**: detection, key decisions, mitigation, resolution, with timestamps.
- **Root and contributing causes**: technical and process (missing test, noisy alert, unclear ownership).
- **What went well / what went poorly / where we were lucky.**
- **Detection and response metrics**: time to detect, time to mitigate, time to resolve.
- **Follow-ups**: each one concrete, with an owner and due date, filed in the normal work tracker, not left in prose.

Follow-up rules:
- Prioritise by what prevents recurrence or shortens detection: a missing test, a new alert or SLO, a runbook fix, a safer default.
- Decisions with lasting architectural effect go to a decision record (harness-ship:documentation-and-adrs).
- Update the runbook used during the incident before closing it.
- Review open follow-ups regularly; an unowned action item is a repeat incident waiting.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Let us find the root cause before changing anything." | Users keep suffering. Mitigate first; diagnose with the system stable. |
| "Rolling back feels like admitting failure." | Rollback is a routine safety tool. Delay is the failure. |
| "It is only Sev3, no need to tell anyone." | Silence erodes trust. Communicate in proportion to impact. |
| "We know who caused it." | People act within the system you built. Fix the system. |
| "The postmortem can wait until things calm down." | Details fade within days. Schedule it before closing the incident. |
| "We will remember the lessons." | Only tracked, owned follow-ups survive. |

## Red Flags

- No named lead; several people changing production at once.
- Severity argued from cause rather than impact.
- No updates for long stretches; stakeholders learning from users.
- Mitigation not recorded, or several changes made together so the effective one is unknown.
- Declaring resolved on the action, not on recovered metrics.
- Postmortem naming individuals as the cause, or listing vague actions ("be more careful").
- Follow-ups with no owner or date; the same incident class recurring.

## Verification

- [ ] An incident lead and severity were recorded, and a timeline kept.
- [ ] Updates went out on the promised cadence.
- [ ] Mitigation was chosen to cut harm, with the rollback decision made explicitly and recorded.
- [ ] Recovery was confirmed by user-facing metrics and held through a bake period.
- [ ] A blameless postmortem exists with timeline, causes and detection/response timings.
- [ ] Every follow-up is filed with an owner and due date; architectural decisions are recorded.
- [ ] The relevant runbook and alerts were updated.

## Integration points (future)

A platform integration could supply, in neutral terms:
- Current release and deployment status, with history and one-step rollback.
- Alert policies, firing alerts and on-call schedules.
- An incident record that links timeline, communication and follow-up actions.
- Service ownership and dependency information to find the right responders.
