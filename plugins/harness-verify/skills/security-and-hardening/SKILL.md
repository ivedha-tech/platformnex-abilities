---
name: security-and-hardening
description: Hardens code against vulnerabilities starting from a threat model, with always/ask-first/never rules, OWASP-style controls, SSRF, secrets, dependency supply-chain, privacy and LLM-output handling. Use when handling untrusted input, authentication, sessions, data storage, uploads, webhooks or third-party integrations, auditing dependencies, or touching personal data.
---

# Security and Hardening

## Overview

Treat every external input as hostile, every secret as sensitive, and every authorization check as mandatory. Security is a constraint on every line that touches user data, authentication or external systems, not a final phase.

## When to Use

- Accepting user input, uploads, webhooks or callbacks
- Implementing authentication or authorization
- Storing or transmitting sensitive data, payments or personal data
- Integrating with external services
- Auditing dependencies or adding a new package

Concrete code for each control is in references/hardening-patterns.md. Open the section you need when you reach that code. Shared checklists (headers, CORS, package-manager matrix, OWASP tables) are in harness-core's security checklist.

## Threat Model First

Controls added without a threat model are guesses. Spend five minutes thinking like an attacker.

1. **Map trust boundaries.** Where does untrusted data enter? HTTP requests, forms, uploads, webhooks, third-party APIs, queues, LLM output, and local values that only look internal: another process's command line or environment, filenames on a shared volume, a path in a job payload. Trust follows who wrote a value, not the channel that delivered it.
2. **Name the assets.** Credentials, personal data, payment data, admin actions, money movement.
3. **Run STRIDE per boundary** as a quick lens:

| Threat | Ask | Typical mitigation |
|---|---|---|
| Spoofing | Can someone impersonate a user or service? | Authentication, signature verification |
| Tampering | Can data change in transit or at rest? | Integrity checks, parameterized queries, HTTPS |
| Repudiation | Can an action be denied later? | Audit logging of security events |
| Information disclosure | Can data leak? | Encryption, field allowlists, generic errors |
| Denial of service | Can it be overwhelmed? | Rate limits, size caps, timeouts |
| Elevation of privilege | Can a user gain rights they should not have? | Authorization checks, least privilege |

4. **Write abuse cases beside use cases.** For each feature ask "how would I misuse this?" and make that the first test.

If you cannot name a feature's trust boundaries, you are not ready to secure it. Most breaches begin in design, not code.

## Three-Tier Boundaries

**Always**
- Validate all external input at the boundary
- Parameterize every database query
- Encode output (use framework auto-escaping, never bypass it)
- Use HTTPS for external traffic
- Hash passwords with bcrypt, scrypt or argon2
- Set security headers (CSP, HSTS, frame and content-type options)
- Use httpOnly, secure, sameSite cookies for sessions
- Run the package manager's native audit against the committed lockfile before each release

**Ask first (human approval)**
- New or changed authentication flows
- Storing a new category of sensitive data
- New external integrations
- CORS changes, upload handlers, rate-limit changes
- Granting elevated roles or permissions

**Never**
- Commit secrets
- Log sensitive data (passwords, tokens, card numbers)
- Treat client-side validation as a security boundary
- Disable security headers for convenience
- Use `eval()` or `innerHTML` with user-provided data
- Keep auth tokens in client-accessible storage such as localStorage
- Expose stack traces or internals to users

## Hardening Controls

### Injection, XSS, access control
Parameterize every query; never build SQL, NoSQL or shell commands from input strings. Use the framework's escaping, and sanitize with an allowlist sanitizer if raw HTML is unavoidable. Check authorization on every request, not just authentication: the caller must own or be permitted on the specific resource (insecure direct object references).

### Authentication and sessions
Use bcrypt (12 or more rounds), scrypt or argon2, with the session secret from the environment. Session cookies are httpOnly, secure and sameSite lax or strict (the CSRF defense; none sends them cross-site), with a bounded lifetime.

### Headers, CORS, responses
Security headers on every response; start CSP from `default-src 'self'` and tighten. CORS uses an explicit origin list from configuration, never a wildcard with credentials. Strip sensitive fields (password hashes, reset tokens) from responses. Error bodies are generic; details go to server logs.

### Input validation and uploads
Validate with a schema at the boundary (shape, lengths, enums, formats), reject with a structured 422, and let downstream code use only the parsed typed value. For uploads, allowlist content types, cap size, and check content signatures where it matters; the extension proves nothing.

### Server-side fetches (SSRF)
Any URL a user influences (webhooks, import-by-URL, image proxies, previews) can be aimed at internal services. Allowlist scheme and host, resolve all DNS records and reject any private or reserved address (loopback, link-local metadata addresses, private and unique-local ranges, IPv4 and IPv6), and forbid redirects. A DNS-rebinding gap remains between check and connect; for high-risk surfaces pin the resolved IP or put a filtering proxy in front.

### Destructive operations on derived paths
A delete, move or overwrite is only as safe as the value naming its target. A shape check proves well-formedness, not authorization. Before the call require all three: the resolved target (symlinks resolved) is under an allowlisted root; it is at least one level below that root; and it carries ownership evidence read before the operation. On refusal, log the rejected target and stop; never fall back to a broader default path. See the hardening patterns reference for the limits of this check.

### Rate limiting
Limit the API generally and auth endpoints strictly (about 10 attempts per 15 minutes). With more than one process, in-memory counters quietly become max times instances, or never fire on serverless. Back the limiter with a shared store.

### Secrets
Secrets come from the environment. Commit a `.env.example` with placeholders; gitignore real env files and key material; check the staged diff before committing. A secret that reaches a remote is compromised: rotate first, then purge history.

### Dependencies and supply chain
1. Identify the installation boundary and package manager from the lockfile, the manager-version field and CI. Stop on disagreement or competing lockfiles, and pin the manager version.
2. Block dependency install scripts by default: bootstrap with scripts disabled, inspect pending script source, approve the minimum, commit the policy, verify with a clean frozen install. Never blanket-approve.
3. Run the native audit against the committed lockfile before every release. Triage critical and high findings by reachability (runtime, build, test, deploy). Never apply forced remediation automatically since it can cross declared version ranges; preview, read changelogs, test each upgrade. Record every deferral with a reason and review date.
4. Audits only match known advisories. They miss newly malicious or typosquatted packages. Review new dependencies, lockfile diffs and script-policy changes together: ownership, maintenance, release age, provenance, transitive graph. Verify registry signatures where supported, and treat missing signatures as a reason to investigate rather than proof of compromise.

### Personal data and privacy
Hardening asks whether an attacker can read data; privacy asks whether you should hold it at all. Data you never collected cannot be breached.
- Classify fields as you add them (non-personal, personal, sensitive).
- Collect only against a stated purpose; "might be useful later" is breach scope. Keep personal data out of telemetry (see harness-operate:observability-and-instrumentation).
- Set retention up front and implement real deletion, including backups, caches, search indexes and analytics copies.
- Support the data-subject rights your jurisdiction requires (export, correct, delete); design the schema so a user's data is findable and erasable.
- Consent gates collection and third-party sharing, and is auditable. Sending personal data to an analytics, advertising or model vendor is sharing and needs an agreement. Make region a configurable policy.

A privacy incident starts the breach-notification clock; run the postmortem with harness-operate:incident-response-and-postmortem.

### AI and LLM features
Model-backed features add attack surface (see the OWASP Top 10 for LLM applications).
- Model output is untrusted input. Never feed it to eval, SQL, a shell, `innerHTML` or a file path; parse defensively, validate against a schema, then encode.
- Prompts can be hijacked by any untrusted text in context (a user message, fetched page, document). A system prompt is not a security boundary; enforce permissions in code.
- Keep secrets, other tenants' data and the full system prompt out of the context window. Scope tool permissions, validate every tool argument, confirm destructive actions, cap tokens, request rate and recursion depth, and partition retrieval embeddings per tenant.

## Review Checklist

Before sign-off, walk harness-core's security checklist: authentication, authorization, input, data protection and privacy, headers and CORS, dependencies, AI features, error handling.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It is an internal tool" | Internal tools get compromised; attackers go for the weakest link. |
| "We will add security later" | Retrofitting is far harder than building it in. |
| "No one would exploit this" | Automated scanners find it. Obscurity is not security. |
| "The framework handles it" | Frameworks provide tools, not guarantees. |
| "It is just a prototype" | Prototypes become production. |
| "Threat modeling is overkill" | Five minutes of attacker thinking prevents design flaws no control can patch. |
| "LLM output is only text" | It can be SQL, a script tag or a shell command. |
| "The audit passed, so the dependency is safe" | Audits miss new malicious packages and do not make install scripts safe. |
| "Collect it now, we might need it" | Data you do not hold cannot be breached or mis-deleted. |
| "We will handle deletion manually" | Manual erasure misses backups and copies; design for it. |
| "Compliance is legal's problem" | Export, deletion, retention and consent are schema and code. |

## Red Flags

- Input passed straight to queries, shells or HTML
- A destructive operation whose target comes from a payload, config or another process, guarded only by a path-shape check
- Secrets in source or history
- Endpoints without authentication or authorization
- Wildcard CORS
- No rate limit on auth endpoints, or an in-memory limiter in front of several instances
- Stack traces shown to users
- Known critical vulnerabilities, competing lockfiles, non-reproducible installs, blanket-approved scripts
- Server fetches of user URLs with no allowlist
- Model output reaching a query, the DOM, a shell or eval
- Secrets, personal data or the full system prompt placed in a model context
- Personal data with no purpose, retention limit or deletion path, or sent to vendors without consent or agreement
- "Delete account" that only flips a flag

## Verification

- [ ] Native audit has no unmitigated reachable critical or high findings; CI keeps the lockfile authoritative and blocks unreviewed install scripts
- [ ] No secrets in source or history
- [ ] All input validated at boundaries
- [ ] Destructive filesystem operations check root, depth and ownership after resolving symlinks
- [ ] Authentication and authorization on every protected endpoint
- [ ] Security headers present (check in browser devtools)
- [ ] Errors expose no internals
- [ ] Rate limiting on auth endpoints, shared store when multi-instance
- [ ] Server-side URL fetches allowlisted
- [ ] Model output validated and encoded before use
- [ ] Personal data classified, minimized, with retention limit
- [ ] Deletion and export work end to end, including backups and copies
