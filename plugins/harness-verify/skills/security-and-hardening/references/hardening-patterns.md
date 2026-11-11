# Hardening Patterns

Code patterns and decision aids for harness-verify:security-and-hardening. The skill states each rule; this file shows one implementation. Open the section you need; it is not meant to be read top to bottom. Examples are TypeScript and Express-style, but the ideas port to any stack.

## Injection

```typescript
// BAD: string concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: parameterized
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

## Broken Authentication

```typescript
const SALT_ROUNDS = 12;
const hashed = await hash(plaintext, SALT_ROUNDS);
const ok = await compare(plaintext, hashed);

app.use(session({
  secret: process.env.SESSION_SECRET,   // from the environment
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
}));
```

## Cross-Site Scripting

```typescript
// BAD
element.innerHTML = userInput;
// GOOD: framework auto-escaping
return <div>{userInput}</div>;
// If HTML is unavoidable, sanitize with an allowlist sanitizer first
const clean = sanitizer.sanitize(userInput);
```

## Broken Access Control

```typescript
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);
  if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
  }
  return res.json(await taskService.update(req.params.id, req.body));
});
```

Authorization is checked against the specific resource, not just "is logged in".

## Security Misconfiguration

```typescript
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],  // tighten if possible
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
```

## Sensitive Data Exposure

```typescript
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}
const API_KEY = process.env.PAYMENT_API_KEY;
if (!API_KEY) throw new Error('PAYMENT_API_KEY not configured');
```

## Server-Side Request Forgery

```typescript
// BAD
await fetch(req.body.webhookUrl);

// GOOD: allowlist scheme and host, reject if ANY resolved IP is non-public, forbid redirects
const ALLOWED_HOSTS = new Set(['hooks.example.com']);

async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  const addrs = await lookup(url.hostname, { all: true });       // resolve all records
  if (addrs.some((a) => !isPublicUnicast(a.address))) throw new Error('private or reserved IP');
  return url;
}
await fetch(await assertSafeUrl(req.body.webhookUrl), { redirect: 'error' });
```

`isPublicUnicast` must reject loopback, link-local (including the cloud metadata address), private and unique-local ranges for IPv4 and IPv6; use a maintained IP-parsing library for this rather than hand-written regexes.

Caveat: the HTTP client resolves DNS again after your check, so a short-TTL record can rebind to an internal address between validation and connection. For high-risk surfaces resolve once and connect to the pinned IP, or route through a filtering proxy.

## Schema Validation at Boundaries

```typescript
const CreateTaskSchema = z.object({
  title: z.string().max(200).trim().min(1),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});

app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() } });
  }
  return res.status(201).json(await taskService.create(result.data)); // typed and validated
});
```

## File Upload Safety

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

function validateUpload(file: UploadedFile) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) throw new ValidationError('File type not allowed');
  if (file.size > MAX_SIZE) throw new ValidationError('File too large');
  // The extension proves nothing; check magic bytes when it matters.
}
```

## Destructive Operations on Derived Paths

A delete, move or overwrite is only as safe as the value naming its target. Where the value was read from (the kernel, a job payload, a sibling service) shows where it arrived from, not who wrote it. A shape check such as "absolute, at least one directory deep" proves well-formedness and gets mistaken for authorization; that is how cleanup code deletes a root instead of a leaf.

Require all three before the call:
1. The resolved target is under an allowlisted root, compared after resolving symlinks, never on the raw string.
2. It is at least one level below that root, so a root is never the target.
3. It carries evidence that it is yours, read before the operation and before any teardown that removes it, otherwise "absent" and "not mine" look the same.

On refusal, log the rejected target and stop. A cleanup that falls back to a broader default path is the failure this prevents.

Two limits. A marker inside the tree is self-attestation: anything that can write there can write the marker, so the expected owner must come from authenticated state and the marker needs integrity protection (restrictive ownership or a MAC). And resolving a path then operating on the name is a check/use race wherever an untrusted process can swap an ancestor: on shared volumes hold the target by descriptor and use no-follow, beneath-the-root operations, or ensure the hierarchy cannot change meanwhile. See harness-core's security checklist for a worked example.

## Dependency Audit Triage

Audits report known advisories. They do not prove a package is trustworthy or that vulnerable code is reachable.

```
Audit reports a vulnerability
+- critical or high
|  +- reachable in runtime, build, test or deploy paths?
|  |  +- yes: fix now (update, patch or replace)
|  |  +- confirmed unused: fix soon, not a blocker
|  +- fix available?
|     +- yes: update to the patched version
|     +- no: workaround, replace, or allowlist with a review date
+- moderate
|  +- reachable in production: next release cycle
|  +- dev-only: backlog
+- low: fix during routine updates
```

Ask: is the vulnerable function actually called, is the dependency runtime or dev-only, is it exploitable in your deployment context (a server-side flaw in a client-only app, for example)? When you defer, record the reason and a review date.

## Rate Limiting

```typescript
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
```

Many limiters keep counters in process memory by default. Behind a load balancer each instance counts separately, so the effective limit is max times instances; on serverless a fresh invocation starts from zero and the auth limit may never fire. Use a shared store (for example a networked key-value store) so counts are global:

```typescript
const authLimiter = createSlidingWindowLimiter({ store: sharedStore, limit: 10, window: '15m' });
const { allowed } = await authLimiter.check(`login:${req.ip}`);
if (!allowed) return res.status(429).end();
```

## Secrets Management

```
.env.example   committed, placeholders only
.env           not committed, real secrets
.env.local     not committed, local overrides
.gitignore:    .env  .env.local  .env.*.local  *.pem  *.key
```

Before committing, list staged files whose diff matches secret-like words, printing names only so the values never land in terminal output or logs:

```bash
git diff --cached -i -G'password|secret|api_key|token' --name-only
```

Any output means review those files. If a secret is ever committed, rotate it: deleting the line or rewriting history is not enough, since it is compromised once it reaches a remote. Revoke and reissue first, then purge history.

## Data Classification

| Class | Examples | Handling |
|---|---|---|
| Non-personal | Aggregates, anonymized counts | Normal |
| Personal | Name, email, IP, device and user IDs | Minimize, access-control, include in export and delete |
| Sensitive | Health, finance, location, biometrics, government IDs, anything about minors | Extra legal basis, stricter access, often encryption and audit logging |

## LLM Output Handling

```typescript
// BAD: model output as a command or markup
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);
container.innerHTML = await llm.reply(userMessage);

// GOOD: output is data; parse defensively, validate, then encode
let intent;
try {
  intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
} catch {
  throw new ValidationError('unexpected model output');
}
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```
