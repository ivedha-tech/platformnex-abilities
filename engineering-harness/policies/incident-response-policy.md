# Incident response policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC7.2 to CC7.5 · ISO 27001 A.5.24 to A.5.28, A.6.8

## Report

Anyone who suspects an incident posts in the incident channel and pages the
security lead immediately. Suspicion is enough. No blame for reporting.

## Severity

| Sev | Meaning | Response |
|---|---|---|
| 1 | Confirmed breach of Confidential/Restricted data, or full production outage | Immediately, all hands, leadership informed within 1 hour |
| 2 | Likely data exposure, major degradation, compromised credential | Within 1 hour in working hours, 4 hours otherwise |
| 3 | Contained security event, minor degradation | Next working day |
| 4 | Near miss, policy violation without impact | Logged, reviewed monthly |

## Process

1. **Declare**: open an `incident` issue, assign an incident commander.
2. **Contain**: revoke credentials, roll back, isolate. Preserve logs and evidence.
3. **Communicate**: status updates at a fixed interval; one named spokesperson.
4. **Eradicate and recover**: fix the cause, restore service, verify.
5. **Learn**: blameless postmortem (`templates/postmortem.md`) within 5 working
   days for Sev 1 and 2, with owned, dated actions.

## Notification

If personal data is involved, the security lead and leadership decide on
notification with legal advice. Working deadlines to plan around:
UK GDPR / GDPR: regulator within 72 hours of becoming aware where there is a
risk to individuals. PIPEDA: regulator and affected individuals as soon as
feasible where there is a real risk of significant harm, and keep a record of
every breach for 24 months. Customer contracts may set shorter deadlines;
check them.

## Readiness

One tabletop exercise per year. On-call contacts and the customer contact list
are kept current in the runbook. **(manual)**
