---
name: deprecation-and-migration
description: Plans the removal of old systems, APIs, and features and the safe migration of consumers to replacements, including zero-downtime database schema changes using expand and contract. Use when replacing or sunsetting a system, moving users between implementations, renaming or dropping a column in production, or deciding whether to maintain or retire legacy code.
---

# Deprecation and Migration

## Overview

Code is a liability: every line needs tests, patches, dependency upgrades, and attention from whoever works nearby. Its value is the behavior it provides, not the code itself. Deprecation is removing code that no longer earns its keep; migration is moving consumers safely to what replaces it. Teams are usually good at building and poor at removing, so this needs deliberate process.

## When to Use

- Replacing a system, API, or library
- Sunsetting an unneeded feature
- Consolidating duplicate implementations
- Dealing with code nobody owns but others depend on
- Changing a production database schema
- Designing something new (plan its removal at design time)

Not for: routine refactors that keep the public interface and behavior unchanged.

## Principles

- **Hyrum's Law.** With enough consumers, every observable behavior, including bugs and timing quirks, gets depended on. Announcing a deprecation is therefore not enough; consumers need active migration help.
- **Design for removal.** Ask "how would we delete this in three years?" Clean interfaces, flags, and small surface area make that possible.
- **The Churn Rule.** If you own the thing being retired, you own getting its consumers off it, or you provide a backward-compatible path that needs no migration.

## The Decision

1. Does it still provide unique value? If yes, keep it.
2. Who depends on it, and how many? Quantify the scope.
3. Does a replacement exist? If not, build it first; never deprecate without an alternative.
4. What does migration cost each consumer? Automate if cheap; weigh if manual.
5. What does not deprecating cost (security exposure, engineer time, complexity)?

### Advisory or compulsory

| Type | Use when | Mechanism |
|---|---|---|
| Advisory | Old system is stable, migration is optional | Warnings, docs, nudges; consumers move on their own schedule |
| Compulsory | Security risk, blocks progress, or unsustainable cost | Fixed removal date plus migration tooling, docs, and support |

Default to advisory. A compulsory deadline without tooling and support is just an announcement.

## The Migration Process

1. **Build the replacement.** It covers all critical use cases, has migration docs, and is proven in production.
2. **Announce and document.** State status, replacement, removal date (or "advisory"), reason, and concrete migration steps.
3. **Migrate incrementally**, one consumer at a time: find every touchpoint, switch to the replacement, verify behavior with tests, remove references to the old system, confirm no regressions.
4. **Remove.** Only after usage is verified at zero (metrics, logs, dependency scan): delete the code, its tests, docs, and configuration, and take down the deprecation notices.

## Migration Patterns

**Strangler.** Run old and new side by side and shift traffic in steps (0%, canary, 50%, 100%). Remove the old system when it carries nothing.

**Adapter.** Keep the old interface, implement it on top of the new system, and migrate the backend before the callers.

```typescript
class LegacyTaskService implements OldTaskAPI {
  constructor(private next: NewTaskService) {}
  getTask(id: number): OldTask {
    const t = this.next.findById(String(id));
    return { id: Number(t.id), title: t.title, done: t.status === 'done' };
  }
}
```

**Flag-based.** Choose the implementation per user or tenant with a flag, moving consumers over gradually.

## Database Schema Migrations: Expand and Contract

Data cannot be rolled back by reverting a deploy, so schema changes are the riskiest migrations. The classic failure is coupling a schema change to the code that uses it: during a rollout, old and new code run together, and one of them queries something that no longer exists. So never change a column in place; make additive steps so that old and new code are both valid at every moment.

```
EXPAND            ->  MIGRATE                  ->  CONTRACT
add new column,       backfill; dual-write         drop old column in a
nullable                                           later, separate deploy
```

Example, renaming `name` to `full_name`:

1. **Expand.** Add `full_name`, nullable. Deploy. Old code ignores it.
2. **Dual-write.** Application writes both columns. Deploy.
3. **Backfill.** Copy existing values in throttled batches to avoid long locks.
4. **Switch reads.** Read from `full_name`, still write both. Deploy and let it bake.
5. **Contract.** Stop writing `name`; then, in a separate later deploy, drop it.

Each step is deployable and reversible alone; if step 4 misbehaves, roll the code back and `full_name` is still being kept current. Treat each phase as a thin slice (harness-build:incremental-implementation).

Rules:
- Additive changes first; destructive changes last, alone, and only after nothing references the old shape.
- Every migration has a down path that you have actually run before merging.
- Backfill in batches off the hot path; one giant update locks the table.
- Build large indexes without blocking writes where the database supports it.
- Put risky cutovers behind a flag.

## Zombie Code

Code with no owner but active consumers. Signs: no commits for months, no maintainer, failing tests nobody fixes, known-vulnerable dependencies, docs pointing at systems that no longer exist. It cannot stay in limbo: either assign an owner and maintain it, or deprecate it with a concrete plan.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It still works, why remove it?" | Unmaintained working code accumulates security and complexity debt silently. |
| "Someone might need it later" | It can be rebuilt; keeping it "just in case" usually costs more. |
| "Migration is too expensive" | Compare against two or three years of maintenance. Migration is often cheaper. |
| "We'll plan deprecation after the new system ships" | By then priorities have moved on. Plan at design time. |
| "Users will migrate on their own" | They will not without tooling, docs, and incentives, or you doing it (Churn Rule). |
| "We can keep both forever" | Two systems doing one job double maintenance, testing, and onboarding. |
| "Just rename the column, it's one line" | During rollout one version will query a missing column. Use expand and contract. |
| "Add and drop in the same migration" | That couples a safe add to a destructive drop. Drops get their own deploy. |
| "We'll write the rollback if needed" | An untested down path is a deploy you cannot reverse. |

## Red Flags

- Deprecation with no replacement, tooling, or docs
- "Advisory" status unchanged for years
- Zombie code with active consumers
- New features added to the deprecated system
- No measurement of current usage, or removal without confirming zero consumers
- Schema change and dependent code shipped together
- Column renamed or dropped in place
- Migration without a tested down path, or a backfill that locks a table

## Verification

After a deprecation:
- [ ] Replacement is production-proven and covers critical use cases
- [ ] Migration guide has concrete steps and examples
- [ ] All consumers migrated, confirmed by metrics or logs
- [ ] Old code, tests, docs, and configuration removed
- [ ] No references to the old system remain
- [ ] Deprecation notices removed

After a schema migration:
- [ ] Shipped in additive phases, not one in-place edit
- [ ] Old and new code valid against the schema at every step
- [ ] Down path tested; backfills batched and throttled
- [ ] Drops and renames shipped in their own deploy after references were gone
