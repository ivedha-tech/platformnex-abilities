# Ideation Session Examples

Study the rhythm and tone rather than the content. The skill should work equally for a startup concept, a feature in an existing product, and a team process.

---

## Example 1: Vague concept (all three phases)

**User:** "I want to help small local restaurants compete with the big delivery platforms."

### Phase 1

> **How might we** give independent restaurants the reach and convenience of the big platforms without commissions that erode their margin and their relationship with customers?

Three sharpening questions: which part of "compete" (acquisition, logistics, ordering UX, retention, fees)? Who is the user, owner or diner? Is software the assumed answer?

**User:** "Owners. They pay 25-30% commission and feel they cannot leave because that is where the customers are. Software, but I am open."

So the problem is not logistics; it is **customer dependency**. Restaurants rent access to their own customers. Variations:

1. **Direct channel toolkit.** Branded ordering by web or SMS so existing customers can reorder directly. Bet: people who already know the restaurant will switch if it is easy.
2. **Inversion: charge the customer.** Small premium for direct orders, zero commission for the restaurant. Bet: enough diners will pay a little to support a local spot.
3. **Constraint removal: no delivery.** Delivery drives most of the cost. Pickup-first ordering keeps all revenue with the restaurant in dense neighbourhoods.
4. **Combination: neighbourhood collective.** Twenty to fifty restaurants share a platform, cost, and cross-promotion.
5. **Audience shift: regulars only.** Skip discovery. Build one-tap "your usual?" reordering for the top customers who drive most revenue.
6. **Expert lens: owners are in the kitchen.** Anything needing management fails, so make it run itself: auto-text regulars who have not ordered in two weeks, post the daily special automatically.

Variations 5 and 6 combine well: a narrow retention tool for a restaurant's best existing customers, with no discovery, delivery, or marketplace. Which directions interest you?

### Phase 2

**User:** "I like 5 and 6. Direct channel (1) feels necessary but dull. Co-op is complex. Let me combine 1, 5, 6."

**Direction A, "regulars engine" (5+6).**
- Core bet: the top fifth of customers will move to direct ordering if it is frictionless and personal.
- Value: high and concrete; every direct reorder avoids the commission.
- Feasibility: medium. Ordering and payment are commodity; identifying regulars without manual work, and the cold start when order history lives on the platform, are hard.
- Differentiation: high in the niche, since platforms optimise for discovery and logistics and ignore this narrow case.
- Assumptions: regulars will use another ordering path (most likely to be wrong); owners will share customer contacts; direct ordering will not cannibalise dine-in.
- Could kill it: habit. The platform app is already on the phone.

**Direction B, channel plus retention (1+5).** Higher ceiling but two products hoping to be better together; ordering alone is already served by existing point-of-sale vendors, and retention alone has no channel. Honest verdict: the instinct to include the "necessary" piece is how products lose focus. Start with A and rely on existing ordering tools if needed.

### Phase 3: one-pager (abridged)

- **Problem:** how might we help restaurants keep their best customers ordering directly without commission?
- **Direction:** the regulars engine, zero owner effort.
- **Assumptions to validate:** regulars will switch channels (test with 5 restaurants and a manual SMS reorder link); owners will hand over contacts.
- **MVP:** SMS-based "your usual?" reorder for one restaurant's top 30 customers, for four weeks.
- **Not doing:** discovery, delivery logistics, a branded app, a restaurant dashboard.

---

## Example 2: Feature in an existing product (codebase-aware)

**User:** "Add real-time collaboration to the editor."

Before asking anything, the agent reads the repository and notes that state lives in a single client-side store with no operation log, and that saves are whole-document writes. That shapes every variation.

Restated: how might we let two people work in the same document without overwriting each other?

Questions: is the pain overwrites, or waiting for a turn? Are users usually co-present, or are they handing work off? Is "real-time" a requirement or a guess at the solution?

**User:** "Mostly handoffs; people clobber each other's saves."

Then the problem is conflict, not liveness. Variations include: section-level locks with visible ownership (cheapest, fits whole-document saves); per-section autosave with merge on conflict; a "someone else edited this" diff-and-choose prompt; presence indicators only; and, as the big option, a full CRDT, flagged honestly as a rewrite of the storage layer that solves a problem users did not report.

Opinion: start with presence plus a conflict diff; it solves the stated pain in days, and reveals whether anyone needs true simultaneity.

---

## Example 3: Team process

**User:** "Our retros have gone stale."

Diagnostic questions show the real problem is that action items die, not that the format is dull. Variations: one action item per retro with an owner and a date, and the next retro opens with a demo of it; an async written retro with a short sync to decide; a format that lets quiet people contribute (anonymous topics, voting, pairs first); a one-question retro that changes weekly; treating each outcome as a two-week experiment; and a weekly anonymous team-health score on the view that safety, not format, is the root issue.

Phase 2 would weigh these by effort to try (nearly zero), risk, and whether the bottleneck is output (items die) or input (same voices, same topics). The brief would recommend one action item with a demo next week, plus anonymous topic submission, and a Not Doing list of new tools, elaborate facilitation, and anything with a budget.

---

## What to notice

1. The restatement changes the frame ("compete" became "retain existing customers").
2. Questions diagnose the type of problem before prescribing.
3. Each variation has a reason it exists.
4. The skill states opinions and says which direction it would pick.
5. Phase 2 is honest about weak differentiation and complexity.
6. The output is actionable: things to test or try, not things to think about.
7. The Not Doing list holds specific, reasoned exclusions.
8. The same structure yields products, feature changes, or zero-cost experiments depending on context.
