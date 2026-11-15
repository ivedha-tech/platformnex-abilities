# Threat model: <system / feature>

- Date, authors, reviewers:
- Highest data class:

## 1. What are we building?
Diagram or list: actors, entry points, components, datastores, external
services. Mark trust boundaries and the region boundary.

## 2. What can go wrong? (STRIDE per boundary)

| # | Component / flow | Threat | Category (S/T/R/I/D/E) | Likelihood | Impact | Mitigation | Owner | Issue |
|---|---|---|---|---|---|---|---|---|

Prompts worth asking every time:
- Who can call this without being authenticated? As someone else?
- What happens with hostile input, including text that reaches an LLM (prompt injection)?
- Where could Restricted data leak: logs, errors, analytics, AI prompts, backups?
- What if a dependency or vendor is compromised or down?
- Can a single compromised credential reach production data?
- Can one tenant see another tenant's data?

## 3. What are we doing about it?
Mitigations become issues. High risks go to the risk register.

## 4. Did we do a good job?
Reviewer sign-off. Revisit when the design changes.
