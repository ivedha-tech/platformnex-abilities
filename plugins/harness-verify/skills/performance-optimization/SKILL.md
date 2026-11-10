---
name: performance-optimization
description: Improves application performance with a measure, identify, fix, verify, guard loop covering frontend vitals, backend queries, indexes, connection pools, caching and bundles, with strict keep-or-revert rules. Use when performance requirements exist, a regression is suspected, load times or Core Web Vitals need work, N+1 queries appear, or profiling reveals a bottleneck.
---

# Performance Optimization

## Overview

Measure before optimizing. Without measurement you are guessing, and guesses add complexity without improving what matters. Profile, find the real bottleneck, fix it, measure again, and keep only what the numbers justify.

## When to Use

- The spec has performance requirements (load budgets, response-time targets)
- Users or monitoring report slowness, or Core Web Vitals miss their thresholds
- You suspect a change caused a regression
- You are building for large datasets or heavy traffic

Not for code with no evidence of a problem: premature optimization costs more in complexity than it returns.

## Core Web Vitals Targets

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | 2.5 s or less | up to 4.0 s | over 4.0 s |
| INP (Interaction to Next Paint) | 200 ms or less | up to 500 ms | over 500 ms |
| CLS (Cumulative Layout Shift) | 0.1 or less | up to 0.25 | over 0.25 |

## Workflow

```
1 MEASURE -> 2 IDENTIFY -> 3 FIX -> 4 VERIFY (keep or revert) -> 5 GUARD
```

### 1. Measure

Use both kinds of data:
- Synthetic (a lab auditing tool, the browser's performance recorder): controlled and reproducible; good for CI and isolating issues.
- Real-user monitoring (a vitals library, field datasets): real conditions; required to confirm a fix helped users.

Frontend: record a performance trace, or report vitals from the page with a vitals library. Backend: response-time logging, an application performance monitor, query logs with timings, or simple timers around the suspect call.

Decide what to measure from the symptom:

```
What is slow?
+- First page load
|  +- large bundle: measure bundle size, check code splitting
|  +- slow server: measure time to first byte in the network waterfall
|  |  +- long DNS: preconnect to known origins
|  |  +- long TCP/TLS: HTTP/2, edge deployment, keep-alive
|  |  +- long server wait: profile backend, queries, caching
|  +- render-blocking resources: check the waterfall
+- Interaction feels sluggish
|  +- UI freezes on click: look for main-thread tasks over 50 ms
|  +- input lag: re-renders, controlled-input overhead
|  +- animation jank: layout thrashing, forced reflow
+- After navigation
|  +- data loading: API times, request waterfalls
|  +- client rendering: component render time, N+1 fetches
+- Backend or API
   +- one endpoint slow: queries, indexes
   +- all endpoints slow: connection pool, memory, CPU
   +- intermittent: lock contention, GC pauses, external dependencies
```

### 2. Identify the bottleneck

Frontend:

| Symptom | Likely cause | Investigate |
|---|---|---|
| Slow LCP | Large images, render-blocking resources, slow server | Waterfall, image sizes |
| High CLS | Images without dimensions, late content, font shifts | Layout-shift attribution |
| Poor INP | Heavy main-thread JS, large DOM updates | Long tasks in a trace |
| Slow initial load | Large bundle, many requests | Bundle size, splitting |

Backend:

| Symptom | Likely cause | Investigate |
|---|---|---|
| Slow API | N+1 queries, missing indexes | Query log |
| Memory growth | Leaked references, unbounded caches, big payloads | Heap snapshot |
| CPU spikes | Heavy synchronous work, regex backtracking | CPU profile |
| High latency | No caching, redundant work, extra network hops | Trace the request |

### 3. Fix the bottleneck

Fix the one thing step 2 named. Worked fixes for each item are in references/optimization-patterns.md; open the one you need.

**Backend**
- **N+1 queries.** One query per row is the most common backend bottleneck. Fetch the relation in the same query (join or include).
- **Unbounded fetching.** Every list endpoint paginates with a limit and a stable order.
- **Queries that ignore their index.** "Add an index" is the guess; the query plan is the measurement. A sequential scan where you expected an index, a row estimate off by an order of magnitude (stale statistics: refresh them, do not add an index), and a sort above the scan each need a different fix. Index for the shape of the query (equality columns first, then the range or sort column). A plain index will not help a dominant low-selectivity value (a partial index serves the rare one), a leading wildcard (needs trigram or full-text), or a function on the column (index the expression). Every index taxes every write. Re-run the plan afterwards; an index that did not change it is a revert.
- **Connection pool exhaustion.** Signature: every endpoint slows at once, time goes to waiting for a connection, the database shows mostly idle sessions. Use one pool per process, sized so instances times max stays under the database's connection ceiling. A bigger pool is not faster; it moves the queue somewhere harder to see. With unbounded instance counts, multiplex through a connection proxy instead of raising the max.
- **Missing caching.** Cache what is expensive to produce and read far more than it changes; caching something already fast adds a hop and a staleness bug for nothing. Choose the layer deliberately (in-process, shared, CDN). Put every input that changes the response in the key (tenant, locale, permissions, flags): a key that omits the viewer serves one user's data to another. Pick one invalidation strategy (TTL, event or tag based, versioned keys) and state the acceptable staleness. Guard hot keys against stampedes: serve stale while one request recomputes, or coalesce concurrent misses behind one in-flight call. Never cache what must be fresh (balances, permissions, inventory at checkout). See harness-core's performance checklist for write strategies and negative caching.

**Frontend**
- **Image optimization.** Every image declares width and height (CLS). The LCP image gets high fetch priority, modern formats and responsive sources; below-the-fold images load lazily and decode asynchronously.
- **Unnecessary re-renders.** An object or function created during render is a new reference every time and re-renders children. Hoist constants; reserve memoization for work the profile shows is expensive, since overuse has its own cost.
- **Bundle size.** Modern bundlers tree-shake named ESM imports already; the real gains are route-level code splitting and lazy-loading heavy, rarely used features. Profile before changing import styles.

### 4. Verify: keep or revert

A fix is a hypothesis until re-measured.

- Re-measure the way you took the baseline: same command, conditions and budget. A cold-cache baseline against a warm-cache result measures the cache, not your change.
- Change one thing at a time, or measure each in isolation before combining.
- Beat the noise: repeat runs and compare against run-to-run variance. A 3% gain inside plus or minus 5% variance is not a gain.

| Result versus baseline | Action |
|---|---|
| Past the threshold, tests green | Keep; put before and after numbers in the commit message |
| Within noise | Revert |
| Worse | Revert |
| Better but a test went red | Revert |

Neutral is a revert. Code you keep, you maintain forever; make it pay for itself. Correctness gates the metric: an "optimization" that wins by dropping needed work (skipping validation, caching what must be fresh, removing a load-bearing await) is a regression.

**Log every attempt**, reverted ones included, because reverted work leaves no trace in history and dead ideas get retried:

| Idea | Baseline to result | Verdict | Why |
|---|---|---|---|
| Memoize the row component | INP 240 ms to 235 ms | reverted | Inside noise; rows were not the bottleneck |
| Virtualize the list | INP 240 ms to 90 ms | kept | Long tasks gone from the trace |

Keep the ledger in the PR description or a notes file that the next person reads before proposing an experiment.

### 5. Guard against regression

Guard the metric users feel, the same one that justified the fix (LCP, INP, p95 latency).

- Synthetic gate in CI with a performance budget; repeat noisy measurements or compare a median or trend so variance does not make the gate flaky.
- Field monitoring that alerts on meaningful p75 movement in real-user data, using attributed vitals data to locate causes.
- When a guard fires, return to step 1 with a fresh baseline.

Example budgets (adapt to your product): initial JavaScript under 200 KB gzipped, CSS under 50 KB, above-the-fold images under 200 KB each, fonts under 100 KB, API p95 under 200 ms, time to interactive under 3.5 s on 4G, lab performance score 90 or more. Enforce them with your CI's bundle-size and lab-audit checks.

See also harness-core's performance checklist, and harness-verify:browser-testing-with-devtools for traces.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We will optimize later" | Performance debt compounds. Fix obvious anti-patterns now; defer micro-optimizations. |
| "It is fast on my machine" | Profile on representative hardware and networks. |
| "This optimization is obvious" | Unmeasured means unknown. |
| "Users will not notice 100 ms" | Users notice more than you expect; measure against your own targets. |
| "The framework handles performance" | It cannot fix N+1 queries or oversized bundles. |
| "Slow query, add an index" | Read the plan first; the index may exist and be unusable, and every index taxes writes. |
| "Just cache it" | Caching a cheap call buys a staleness bug. Cache what is expensive and re-read often. |
| "Raise the pool size" | A pool bigger than the database can serve hides the queue. Find what holds connections. |
| "It did not help, but it does not hurt" | Neutral is a revert; you maintain it forever. |
| "We already wrote it, keep it" | Sunk cost. |
| "The win is obvious, no need to re-measure" | Then re-measuring is cheap. Unmeasured wins are how neutral complexity lands. |

## Red Flags

- Optimization with no profiling data
- N+1 patterns in data fetching
- An index added without plans before and after
- A cache key missing an input the response depends on, or no staleness window or invalidation strategy
- Pool size raised without finding what holds connections
- List endpoints without pagination
- Images without dimensions, lazy loading or responsive sizes
- Bundle growth without review; no production performance monitoring
- Memoization everywhere
- Optimizations kept without re-measurement, or bundled so none can be attributed
- A "win" that needed a test changed, skipped or deleted
- A failed optimization retried because nobody recorded it

## Verification

- [ ] Before and after numbers exist
- [ ] Re-measured the same way as the baseline
- [ ] Improvement exceeds run-to-run variance
- [ ] Changes that did not beat the baseline were reverted
- [ ] Attempts are logged, kept and reverted
- [ ] The specific bottleneck was identified and addressed
- [ ] Core Web Vitals are in the Good range
- [ ] Bundle size did not grow significantly
- [ ] No N+1 queries in new data-fetching code
- [ ] New indexes justified by plans and write cost considered
- [ ] New caches state their key and staleness
- [ ] The user-facing metric has a budget or field monitor that can detect regression
- [ ] Existing tests still pass
