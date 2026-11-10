# Performance Checklist (reference)

A quick reference for web application performance. Measure before optimizing; apply items only where evidence shows they matter.

## Core Web Vitals targets

| Metric | Good | Needs work | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | <= 2.5s | <= 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | <= 200ms | <= 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | <= 0.1 | <= 0.25 | > 0.25 |

## TTFB diagnosis

When TTFB exceeds about 800ms, find the slow phase in the network waterfall.

- [ ] DNS slow: add `dns-prefetch` or `preconnect` for known origins
- [ ] TCP/TLS slow: enable HTTP/2, consider edge deployment, verify keep-alive
- [ ] Server processing slow: profile the backend, check slow queries, add caching

## Frontend

### Images
- [ ] Modern formats (WebP, AVIF)
- [ ] Responsive sizing (`srcset`, `sizes`)
- [ ] Explicit `width` and `height` on images and `<source>` elements (prevents CLS)
- [ ] Below-the-fold images use `loading="lazy"` and `decoding="async"`
- [ ] Hero/LCP image uses `fetchpriority="high"` and is not lazy-loaded

### JavaScript
- [ ] Initial bundle under about 200KB gzipped
- [ ] Code splitting with dynamic `import()` for routes and heavy features
- [ ] Tree shaking effective (dependencies ship ESM and declare `sideEffects: false`)
- [ ] No blocking scripts in `<head>`; use `defer` or `async`
- [ ] Heavy computation moved to Web Workers where applicable
- [ ] Memoization (`React.memo`, `useMemo`, `useCallback`) only where profiling shows a benefit
- [ ] Long tasks (over 50ms) broken up; this is the main lever for INP
- [ ] Yield to the main thread inside long loops (`scheduler.yield()` where available, else a timeout-based fallback)
- [ ] `requestIdleCallback` for deferrable work (analytics flush, prefetch)
- [ ] Non-critical work (analytics, logging) kept out of event handlers
- [ ] Third-party scripts loaded `async`/`defer`, audited for size, and fronted by a facade when heavy

### CSS
- [ ] Critical CSS inlined or preloaded; non-critical CSS not render-blocking
- [ ] No CSS-in-JS runtime cost in production (extract)

### Fonts
- [ ] 2-3 families and 2-3 weights at most
- [ ] WOFF2 only
- [ ] Self-hosted where possible
- [ ] LCP-critical fonts preloaded (`rel="preload" as="font" type="font/woff2" crossorigin`)
- [ ] `font-display: swap` (or `optional` for non-critical)
- [ ] Subsetted with `unicode-range`; variable fonts considered
- [ ] Fallback metrics tuned (`size-adjust`, `ascent-override`, `descent-override`) to limit CLS on swap
- [ ] A system font stack considered first

### Network
- [ ] Static assets cached with long `max-age` and content hashing
- [ ] API responses cached where appropriate (`Cache-Control`)
- [ ] HTTP/2 or HTTP/3; known origins preconnected; no needless redirects
- [ ] `fetchpriority` used on critical non-image resources too

### Rendering
- [ ] No layout thrashing (forced synchronous layouts)
- [ ] Animations use `transform` and `opacity`
- [ ] Long lists virtualized
- [ ] No needless full-page re-renders
- [ ] Off-screen sections use `content-visibility: auto` with `contain-intrinsic-size`
- [ ] No `unload` handlers and no `Cache-Control: no-store` on HTML, so back/forward cache works

## Backend

### Database
- [ ] No N+1 patterns (eager loading or joins)
- [ ] Indexes match query shapes
- [ ] List endpoints paginated; never `SELECT *` over a whole table
- [ ] Connection pooling configured; slow-query logging on

Query plans
- [ ] `EXPLAIN ANALYZE` captured before the fix as the baseline
- [ ] Any sequential scan on a large table understood: missing index, unusable index, or not worth it
- [ ] Estimated vs actual row counts within an order of magnitude (otherwise refresh statistics first)
- [ ] No sort node a composite index could absorb
- [ ] Plan re-checked after the change; an index that did not change the plan is reverted

Index strategy
- [ ] Composite order: equality columns first, then range or sort
- [ ] Index covers the query shape (filter plus sort), not one column alone
- [ ] Covering index considered for hot reads
- [ ] Low-selectivity columns not indexed for the dominant value; a partial index can still serve the rare value
- [ ] Expression index where the query applies a function (for example `lower(email)`)
- [ ] Full-text or trigram index for leading-wildcard search, not a B-tree
- [ ] Write cost measured on write-heavy tables
- [ ] Unused and duplicate indexes dropped

Connection pooling
- [ ] One pool per process, not per request or module
- [ ] instances x pool max stays under the database's connection limit
- [ ] Connection timeout set so exhaustion fails fast
- [ ] Exhaustion diagnosed before resizing: long transactions, missing `await`, leaked clients
- [ ] Serverless or autoscaling workloads go through a multiplexing proxy

### API
- [ ] p95 response time target defined (for example under 200ms) and met
- [ ] No heavy synchronous computation in request handlers
- [ ] Bulk operations instead of loops of single calls
- [ ] Response compression (gzip or brotli)
- [ ] Appropriate caching (in-memory, shared cache, CDN)

### Infrastructure
- [ ] CDN for static assets
- [ ] Servers near users, or edge deployment
- [ ] Horizontal scaling configured if needed
- [ ] Health check endpoint for the load balancer

## Caching

### Read and write patterns

| Pattern | How it works | Use when | Watch out for |
|---|---|---|---|
| Cache-aside | App checks cache; on miss reads origin and fills | Default; read-heavy, tolerates a cold first hit | Every miss hits origin; needs stampede protection |
| Read-through | Cache layer loads on miss | You want the load path in one place | Hides origin latency |
| Write-through | Write goes to cache and origin together | Reads must never be stale after a write | Adds latency to every write |
| Write-behind | Write hits cache; origin updated asynchronously | Write-heavy with the origin as bottleneck | Data loss window if the cache dies before flush |

### Negative caching

Cache the absence of a result too, or a key that always misses (a nonexistent ID probed in a loop) sends every request to the origin.
- Store an explicit "not found" marker with a shorter TTL than positive entries
- Keep that TTL short enough for new records to appear promptly
- Never cache an origin error as a negative entry

### Request coalescing

One recompute, many waiters, so a hot key's expiry does not send the full load to the origin.

```typescript
const inFlight = new Map<string, Promise<unknown>>();

function loadOnce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
```

For a shared cache, use a distributed lock or stale-while-revalidate.

### Cache checklist
- [ ] The cached call was measured as expensive first
- [ ] Reads far outnumber writes
- [ ] Key includes every input the response varies on: tenant, viewer, locale, permissions, flags
- [ ] No per-user data under a key that does not identify the user
- [ ] One invalidation strategy (TTL, event or tag, or versioned keys), not an accidental mix
- [ ] Acceptable staleness written down
- [ ] Stampede protection on hot keys
- [ ] Negative results cached briefly; errors never cached
- [ ] Eviction policy and memory ceiling set
- [ ] Hit rate monitored
- [ ] Nothing cached whose staleness is a correctness bug (balances, permissions, checkout inventory)

## Measurement

1. Field data first: check real-user INP and other vitals (RUM or CrUX) before optimizing.
2. Identify slow interactions: record a performance trace while interacting and look for long tasks.
3. Test on mid-range hardware: use a real device or 4x-6x CPU throttling.

```bash
npx lighthouse http://localhost:3000 --output json --output-path ./report.json
npx vite-bundle-visualizer          # or webpack-bundle-analyzer for webpack
```

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(console.log); onINP(console.log); onCLS(console.log);

// Interaction-level INP detail (attribution build exports the same names; alias it)
import { onINP as onINPWithAttribution } from 'web-vitals/attribution';
onINPWithAttribution(({ value, attribution }) => console.log(value, attribution));
```

## Common anti-patterns

| Anti-pattern | Impact | Fix |
|---|---|---|
| N+1 queries | Linear DB load growth | Joins, includes, batch loading |
| Unbounded queries | Memory exhaustion, timeouts | Paginate; add LIMIT |
| Missing indexes | Slow reads as data grows | Index filtered and sorted columns |
| Indexing without reading the plan | Write cost, unproven gain | EXPLAIN before and after; revert if unchanged |
| Redundant or unused indexes | Every write pays | Audit usage; drop |
| Connection pool per request | Exhausts connections | One pool per process; proxy for serverless |
| Cache key missing the viewer | One user's data served to another | Key on tenant, viewer, locale, permissions |
| Unbounded cache | A memory leak | Eviction policy and ceiling |
| Stampede on a hot key | Origin takes full load at expiry | Coalesce, or stale-while-revalidate |
| Layout thrashing | Jank | Batch reads, then writes |
| Unoptimized images | Slow LCP | Modern formats, responsive sizes, lazy load |
| Large bundles | Slow interactivity | Code split, tree shake, audit dependencies |
| Blocking the main thread | Poor INP | Chunk long tasks, yield, use workers |
| Memory leaks | Growing memory, crash | Clean up listeners, intervals, refs |
