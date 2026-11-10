# Optimization Patterns

Worked fixes for the anti-patterns in step 3 of harness-verify:performance-optimization. The skill gives the rule and the signature; this file gives one implementation. Open a section only after step 2 has identified the bottleneck. Checklists and caching write strategies are in harness-core's performance checklist.

## N+1 Queries

```typescript
// BAD: one query per task for the owner
const tasks = await db.tasks.findMany();
for (const task of tasks) {
  task.owner = await db.users.findUnique({ where: { id: task.ownerId } });
}

// GOOD: a single query with the relation included
const tasks = await db.tasks.findMany({ include: { owner: true } });
```

## Unbounded Data Fetching

```typescript
// BAD
const allTasks = await db.tasks.findMany();

// GOOD: paginated, stable order
const tasks = await db.tasks.findMany({ take: 20, skip: (page - 1) * 20, orderBy: { createdAt: 'desc' } });
```

## Queries That Ignore Their Index

```sql
EXPLAIN ANALYZE
SELECT id, title FROM tasks WHERE owner_id = 42 ORDER BY created_at DESC LIMIT 20;
```

| What you see | Meaning |
|---|---|
| Sequential scan on a large table where you expected an index | No usable index for this predicate |
| Estimated rows far from actual | Stale statistics; refresh them |
| A sort step above the scan | The index covers the filter but not the ORDER BY |

Index for the query shape: equality columns first, then the range or sort column.

```sql
CREATE INDEX idx_tasks_owner_created ON tasks (owner_id, created_at DESC);
```

When an index will not help:

| Situation | Why |
|---|---|
| Querying the dominant value of a low-selectivity column | A sequential scan is cheaper; the planner ignores the index. Filtering on the rare value is the opposite case, and a partial index serves it |
| Leading wildcard (`LIKE '%term'`) | A B-tree cannot seek without a prefix; use trigram or full-text |
| Function on the column (`WHERE lower(email) = ?`) | The plain index is unusable; index the expression |
| Write-heavy table | Each index taxes every write; measure write cost too |

Re-run the plan afterwards. An index that did not change it is a revert, and it still costs on every write.

## Connection Pool Exhaustion

Signature: every endpoint slows together, the time is spent waiting for a connection, and the database shows mostly idle sessions.

```typescript
// BAD: a pool per request or per module; under serverless this multiplies by instance count
// GOOD: one pool per process, sized against the database ceiling
const pool = new Pool({
  max: 10,                        // instances x max must stay under the database's connection limit
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000, // fail fast rather than queue forever
});
```

Bigger is not faster: an oversized pool moves the queue into the database where it is harder to see. When instance count is unbounded (serverless, autoscaling), use a connection-multiplexing proxy rather than a higher max.

## Image Optimization (Frontend)

```html
<!-- BAD: no dimensions, no format optimization -->
<img src="/hero.jpg" />

<!-- GOOD: LCP image with art direction, resolution switching and high priority -->
<picture>
  <source media="(max-width: 767px)"
          srcset="/hero-mobile-400.avif 400w, /hero-mobile-800.avif 800w"
          sizes="100vw" width="800" height="1000" type="image/avif" />
  <source srcset="/hero-800.avif 800w, /hero-1200.avif 1200w, /hero-1600.avif 1600w"
          sizes="(max-width: 1200px) 100vw, 1200px" width="1200" height="600" type="image/avif" />
  <img src="/hero-desktop.jpg" width="1200" height="600" fetchpriority="high" alt="Hero description" />
</picture>

<!-- GOOD: below the fold, lazy and async -->
<img src="/content.webp" width="800" height="400" loading="lazy" decoding="async" alt="Content description" />
```

Add a WebP source alongside AVIF where you need a fallback.

## Unnecessary Re-renders (React)

```tsx
// BAD: a new object each render makes children re-render
function TaskList() {
  return <TaskFilters options={{ sortBy: 'date', order: 'desc' }} />;
}

// GOOD: stable reference
const DEFAULT_OPTIONS = { sortBy: 'date', order: 'desc' } as const;
function TaskList() {
  return <TaskFilters options={DEFAULT_OPTIONS} />;
}

// Memoize only what the profile shows is expensive
const TaskItem = React.memo(function TaskItem({ task }: Props) { /* expensive render */ });

function TaskStats({ tasks }: Props) {
  const stats = useMemo(() => calculateStats(tasks), [tasks]);
  return <div>{stats.completed} / {stats.total}</div>;
}
```

## Large Bundle Size

```typescript
// Modern bundlers tree-shake named ESM imports when the dependency ships ESM and
// declares it has no side effects. Profile before changing import styles; the real
// gains come from splitting and lazy loading.

const ChartLibrary = lazy(() => import('./ChartLibrary'));   // heavy, rarely used
const SettingsPage = lazy(() => import('./pages/Settings')); // route-level split

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <SettingsPage />
    </Suspense>
  );
}
```

## Missing Caching (Backend)

Cache what is expensive to produce and read far more than it changes. Caching something already fast adds a hop, a staleness bug and an eviction policy for nothing.

| Layer | Visible to | Use when | Cost |
|---|---|---|---|
| In-process (map, LRU) | One instance | Small, hot, per-instance staleness is fine | Instances drift; invalidation reaches only one |
| Shared store | All instances | Instances must agree, or recompute is expensive | A network hop and another service to run |
| CDN or edge | Everyone, per URL | Public, identical responses | Invalidation is hard; assume a bad response cannot be recalled quickly |

```typescript
const CACHE_TTL = 5 * 60 * 1000;
let cachedConfig: AppConfig | null = null;
let cacheExpiry = 0;

async function getAppConfig(): Promise<AppConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;
  cachedConfig = await db.config.findFirst();
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedConfig;
}

// Fingerprinted static assets: cache for a year, never revalidate
app.use('/static', express.static('public', { maxAge: '1y', immutable: true }));

// API responses: short public cache
res.set('Cache-Control', 'public, max-age=300');
```

**Key design decides correctness.** Every input that changes the response goes in the key: tenant, locale, permissions, flags. A key that omits the viewer serves one user's data to another, and ships as a "performance win".

| Invalidation strategy | Trade-off |
|---|---|
| TTL | Simplest; accept staleness up to the TTL and state the window |
| Event or tag based | Fresh on write, but writers must know the cache topology |
| Versioned keys (`user:42:profile:v7`) | Never invalidate; stop reading old keys. Costs memory until eviction |

Choose one, not three.

**Stampedes.** When a hot key expires, every concurrent request misses at once and the origin takes the full load. Serve stale while a single request recomputes, or coalesce concurrent misses behind one in-flight promise so N waiters cause one recompute.

**Do not cache** anything whose staleness is a correctness bug (balances, permissions, checkout inventory), or per-user data under a key that does not identify the user.
