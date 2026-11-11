---
name: api-and-interface-design
description: Guides design of stable interfaces that are hard to misuse, covering REST and GraphQL endpoints, module boundaries, type contracts, errors, pagination and idempotency. Use when designing or changing any public interface, or when drawing the boundary between frontend and backend or between modules.
---

# API and Interface Design

## Overview

Design interfaces that make the right thing easy and the wrong thing hard. The same principles apply to REST endpoints, GraphQL schemas, module boundaries, component props, and any seam where one piece of code calls another.

## When to Use

- New endpoints or schemas
- Module boundaries or contracts between teams
- Component prop interfaces
- Database schema that will shape an API
- Changing anything already public

## Core Principles

### Hyrum's Law

With enough users, every observable behaviour will be depended on, whatever the contract says. That includes quirks, error text, timing and ordering. So: be deliberate about what you expose, do not leak implementation details, plan removal at design time (see harness-ship:deprecation-and-migration), and remember contract tests cannot catch reliance on undocumented behaviour.

### One-version rule

Do not make consumers choose between versions of the same thing. Extend rather than fork, so a single version exists at a time and diamond dependency problems do not arise.

### 1. Contract first

Write the interface, with comments stating semantics, before the implementation:

```typescript
interface TaskAPI {
  createTask(input: CreateTaskInput): Promise<Task>;        // returns server-generated fields
  listTasks(params: ListTasksParams): Promise<Page<Task>>;
  getTask(id: string): Promise<Task>;                       // throws NotFoundError
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>; // partial update
  deleteTask(id: string): Promise<void>;                    // idempotent
}
```

### 2. One error model

Use a single shape everywhere:

```typescript
interface APIError {
  error: { code: string; message: string; details?: unknown };
}
```

Map statuses consistently: 400 malformed, 401 unauthenticated, 403 unauthorized, 404 missing, 409 conflict, 422 semantically invalid, 500 server fault (never leak internals). Do not have some endpoints throw, some return null and others return an error object.

### 3. Validate at the boundary

Validate where external input enters: route handlers, form handlers, third-party responses (always untrusted: check shape and content before use), and environment configuration. After validation, internal code trusts its types. Do not re-validate between internal functions or on data you just read from your own database.

### 4. Add, do not change

Extend with optional fields. Removing a field or changing its type breaks existing consumers.

### 5. Predictable naming

Plural nouns and no verbs in REST paths (`GET /tasks`), one casing style for params and fields, `is/has/can` prefixes for booleans, one convention for enum values. Match what the codebase already does.

### 6. Honour idempotency keys

Accepting a key is the contract; honouring it is the implementation. A key handled carelessly is worse than none, because the client now believes retry is safe.

- **Derive the key from the intent, not the attempt.** It must be the same across retries of one intent and different across distinct intents. A fresh UUID or timestamp per attempt makes every retry a new charge; a key of user plus amount merges two legitimate payments. Take it from the client or initiating event, or derive it from an immutable id (`charge:v1:<orderId>`), never from the retrying layer.
- **Claim atomically.** Check-then-act is a race. Insert the key with a unique constraint and let the database pick the winner; on a unique violation, replay or reject. A store that cannot enforce uniqueness in one operation cannot back this.
- **Guard the payload.** Store a hash of the request; the same key with a different body returns 422 (`IDEMPOTENCY_KEY_REUSED`), not the first response.
- **Choose the in-flight duplicate behaviour on purpose:** reject with 409 (simplest), wait for the result for a bounded time, or return 202 with a status URL for long effects. Never let a second caller through because the first "seems stuck".
- **Plan for the unknown outcome.** Calls end in success, failure or unknown; a timeout does not tell you the effect did not happen. Record intent before calling out so a crash leaves evidence to resolve.
- **Set retention from the longest retry path** (dead-letter replay, provider dispute windows), not from storage cost.

## REST Patterns

```
GET    /tasks            list (filter by query params)
POST   /tasks            create
GET    /tasks/:id        read
PATCH  /tasks/:id        partial update
DELETE /tasks/:id        delete
GET    /tasks/:id/comments   sub-resource
```

Paginate every list: accept page and page size (or an opaque page token) plus sort, and return the data with pagination metadata. Filter with query parameters (`?status=open&assignee=u1`). Accept partial bodies on PATCH and change only what is given.

## TypeScript Patterns

- **Discriminated unions** for variants, so consumers get narrowing and exhaustive switches (`{type:'pending'} | {type:'completed', completedAt:Date}`).
- **Input/output separation:** `CreateTaskInput` is what callers send; `Task` adds server-generated id, timestamps and owner.
- **Branded ID types** (`TaskId`, `UserId`) so one cannot be passed for the other.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll document it later" | The types are the documentation; write them first. |
| "No pagination yet" | You will need it the moment lists grow. |
| "PUT is simpler than PATCH" | PUT forces full objects; clients want partial updates. |
| "We'll version when needed" | Unplanned breaking changes break consumers. Design for extension. |
| "Nobody uses that undocumented behaviour" | Hyrum's Law says somebody does. |
| "We can run two versions" | Doubles maintenance and invites diamond problems. |
| "Internal APIs need no contract" | Internal consumers are consumers. |
| "Accepting the header is enough" | The key must be stored against the result and claimed atomically. |
| "Our queue is exactly-once" | Across a consumer crash it is not. Design for at-least-once with idempotent handlers. |
| "Duplicates are rare" | They spike exactly when a dependency is degraded. |

## Red Flags

- Endpoints whose response shape varies by condition
- Different error formats across endpoints
- Validation scattered through internal code
- Type changes or removals on existing fields
- Unpaginated lists; verbs in REST URLs
- Third-party responses used unvalidated
- A SELECT on an idempotency key followed by an INSERT
- Keys regenerated per attempt, or reused with a different body and silently replayed
- Retention shorter than the longest redelivery path

## Verification

- [ ] Every endpoint has typed input and output schemas
- [ ] One error format throughout
- [ ] Validation only at system boundaries
- [ ] List endpoints paginated
- [ ] New fields additive and optional
- [ ] Naming conventions consistent
- [ ] Docs or types committed with the implementation
- [ ] State-changing endpoints honour an idempotency key or are documented as unsafe to retry
- [ ] Key claimed in one atomic operation under a unique constraint
- [ ] Reused key with different payload fails loudly
- [ ] In-flight duplicate handling (409, wait, 202) is a deliberate choice
- [ ] Key retention outlives the longest retry path
