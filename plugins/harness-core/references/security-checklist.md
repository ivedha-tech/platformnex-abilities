# Security Checklist (reference)

A quick reference for web application security.

## Threat modeling (start here)

Spend five minutes thinking like an attacker before choosing controls.

- [ ] Trust boundaries mapped: requests, uploads, webhooks, third-party APIs, LLM output, and local values written by processes you do not control
- [ ] Assets named: credentials, PII, payment data, admin actions, money movement
- [ ] STRIDE run per boundary (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)
- [ ] Abuse cases written beside use cases ("how would I misuse this?")

## Pre-commit checks

- [ ] No secrets in code. Listing only file names keeps values off screen: `git diff --cached -i -G'password|secret|api_key|token' --name-only`. Any output means review those files before committing.
- [ ] `.gitignore` covers `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example` holds placeholders, not real secrets

## Authentication

- [ ] Passwords hashed with bcrypt (12 or more rounds), scrypt, or argon2
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] Session expiry configured
- [ ] Rate limit on login (for example at most 10 attempts per 15 minutes)
- [ ] Password reset tokens time-limited (for example 1 hour) and single-use
- [ ] Optional: lockout after repeated failures (with notification); MFA for sensitive operations

## Authorization

- [ ] Every protected endpoint checks authentication
- [ ] Every resource access checks ownership or role (prevents IDOR)
- [ ] Admin endpoints verify the admin role
- [ ] API keys scoped to minimum permissions
- [ ] JWTs validated for signature, expiry and issuer

## Input validation

- [ ] All input validated at system boundaries (routes, form handlers)
- [ ] Allowlists, not denylists
- [ ] String lengths and numeric ranges constrained
- [ ] Email, URL and date formats checked with proper libraries
- [ ] File uploads: type restricted, size limited, content verified
- [ ] SQL parameterized, never concatenated
- [ ] HTML output encoded (use framework auto-escaping)
- [ ] Redirect targets validated (no open redirects)
- [ ] Server-side fetches of URLs allowlisted; private and reserved IPs blocked (SSRF)
- [ ] Destructive path operations (delete, move, overwrite): symlinks resolved, allowlisted root, minimum depth, ownership evidence read before the call

### Destructive path operations

Resolve first, then decide; treat the result as a candidate, not authorization.

```typescript
import { realpath, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, sep } from 'node:path';

const ALLOWED_ROOTS = ['/var/lib/myapp/sessions']; // an allowlist, not a pattern

async function resolveDeletable(candidate: string, expectedOwner: string) {
  const target = await realpath(resolve(candidate)); // resolve symlinks BEFORE checking
  const inRoot = ALLOWED_ROOTS.some((root) => {
    const rel = relative(root, target);
    // Match '..' exactly or '..' + separator; a plain startsWith('..') would
    // also reject a legitimate child named '..cache'.
    return !(rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel));
  });
  if (!inRoot) throw new Error(`refusing: outside allowed roots (${target})`);

  const owner = await readFile(join(target, '.owner'), 'utf8').catch(() => null);
  if (owner?.trim() !== expectedOwner) throw new Error(`refusing: unproven owner (${target})`);
  return target;
}
```

Limits of this pattern:
- The `.owner` marker is self-attestation: anything that can write in the root can write it. `expectedOwner` must come from authenticated state, and the marker needs integrity protection (restrictive ownership or a MAC).
- Returning a path leaves a check/use race. If an untrusted process can swap an ancestor between check and use, operate on a descriptor with no-follow, beneath-the-root semantics, or guarantee the hierarchy is immutable meanwhile.

## Security headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0            (disabled; rely on CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## CORS

```typescript
// Restrictive (recommended)
cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})
// Never in production: cors({ origin: '*' })
```

## Data protection

- [ ] Sensitive fields (`passwordHash`, `resetToken`, ...) excluded from API responses
- [ ] Passwords, tokens and card numbers never logged
- [ ] PII encrypted at rest where regulation requires
- [ ] HTTPS for all external communication; backups encrypted
- [ ] Personal data classified, collected for a stated purpose, and minimized
- [ ] Retention limit and a working deletion path, including backups, caches and indexes
- [ ] Export and delete requests supported where required; third-party sharing has consent and a data-processing agreement

## Dependency security

- [ ] One authoritative lockfile per project or workspace root, committed; CI installs from it frozen and never rewrites it
- [ ] The ecosystem's known-advisory audit runs in CI (for example `npm audit`, `pip-audit`); critical and high findings are triaged for reachability, and deferrals carry a reason and review date
- [ ] Forced or automatic audit remediation is never blind; review diffs and changelogs
- [ ] Registry signatures or provenance verified where the package manager supports it
- [ ] Dependency install scripts are blocked until reviewed: bootstrap installs with scripts disabled, inspect any script that is needed, and allow only those through the package manager's own allowlist mechanism (check the pinned version's documentation, since these features and defaults change)
- [ ] New dependencies reviewed for ownership, maintenance, release age, provenance, transitive graph, and typosquatting. Advisory audits do not catch newly malicious packages.

## AI / LLM security

For any feature that calls a model (chatbots, summarizers, agents, RAG):

- [ ] Model output treated as untrusted; never passed to eval, SQL, shell, innerHTML or file paths
- [ ] Prompt injection assumed; permissions enforced in code, not the system prompt
- [ ] Secrets, cross-tenant data and the full system prompt kept out of context
- [ ] Tool and agent permissions scoped; destructive or irreversible actions need confirmation
- [ ] Token, rate and recursion limits set

## Error handling

```typescript
// Production: generic error, no internals
res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });

// Never: err.message, err.stack, err.sql in the response
```

## OWASP Top 10 quick reference

| # | Vulnerability | Prevention |
|---|---|---|
| 1 | Broken access control | Auth checks on every endpoint; ownership verification |
| 2 | Cryptographic failures | HTTPS, strong hashing, no secrets in code |
| 3 | Injection | Parameterized queries, input validation |
| 4 | Insecure design | Threat modeling, spec-first development |
| 5 | Security misconfiguration | Security headers, minimal permissions, audited dependencies |
| 6 | Vulnerable components | Dependency audit, keep updated, keep few |
| 7 | Authentication failures | Strong passwords, rate limiting, session management |
| 8 | Data integrity failures | Verify updates and dependencies; signed artifacts |
| 9 | Logging failures | Log security events; never log secrets |
| 10 | SSRF | Allowlist URLs; restrict outbound requests |

## OWASP Top 10 for LLM applications

| ID | Risk | Prevention |
|---|---|---|
| LLM01 | Prompt injection | Do not treat the system prompt as a boundary; enforce permissions in code |
| LLM02 | Sensitive information disclosure | Keep secrets and PII out of prompts; filter outputs |
| LLM03 | Supply chain | Vet models, datasets and plugins like any dependency |
| LLM04 | Data and model poisoning | Trusted sources, integrity checks; vet fine-tuning and RAG data |
| LLM05 | Improper output handling | Treat output as untrusted; validate, parameterize, encode |
| LLM06 | Excessive agency | Scope tool permissions; confirm destructive actions |
| LLM07 | System prompt leakage | Assume it can leak; put no secrets in it |
| LLM08 | Vector and embedding weaknesses | Partition embeddings per tenant; validate documents before indexing |
| LLM09 | Misinformation | Ground answers with citations; validate critical claims; keep a human in the loop |
| LLM10 | Unbounded consumption | Cap tokens, request rate and loop depth |
