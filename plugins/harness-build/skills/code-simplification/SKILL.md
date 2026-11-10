---
name: code-simplification
description: Reduces complexity in working code while preserving exact behaviour, so it is easier to read, change and debug. Use when code works but is deeply nested, overlong, unclearly named or duplicated, when review flags readability, or when asked to simplify, clean up or flatten a function or module.
---

# Code Simplification

## Overview

Simplify by lowering complexity with behaviour held identical. The goal is not fewer lines; it is code a new teammate understands faster than the original. That is the test for every change.

## When to Use

- A feature works and passes tests but feels heavier than it should
- Review flags readability or complexity
- Deep nesting, long functions, unclear names, scattered or duplicated logic
- Code written under time pressure, or merges that left inconsistency

Do not use when the code is already clear, when you do not yet understand it, when the simpler form would be measurably slower in a hot path, or when the module is about to be rewritten.

## Five Principles

1. **Preserve behaviour exactly.** Same outputs for every input, same errors, same side effects and ordering, and existing tests pass unmodified. If you cannot be sure, do not make the change.
2. **Follow project conventions.** Read the rules file and neighbouring code, and match import order, function style, naming, error handling and typing depth. Simplification that breaks consistency is churn.
3. **Clarity over cleverness.** Prefer an explicit if-chain or lookup over a nested ternary, and a named loop over a dense reduce with inline spreading, when the compact form needs a pause to parse.
4. **Keep balance.** Over-simplifying is a failure mode: inlining a helper that named a concept, merging unrelated functions, deleting an abstraction that exists for testability, optimizing line count.
5. **Scope to what changed.** Default to code you recently touched. No drive-by refactors; they add diff noise and regression risk.

## Process

### Step 1: Understand first (Chesterton's Fence)

Before changing or removing something, learn why it exists. Answer: what is its responsibility, what calls it and what does it call, what are the edge cases and error paths, which tests define its behaviour, why might it be written this way (performance, platform quirk, history), and what does `git blame` say about the original context. If you cannot answer these, read more first.

### Step 2: Spot opportunities

**Structure**

| Signal | Remedy |
|---|---|
| Nesting of 3+ levels | Guard clauses or helper functions |
| Functions of 50+ lines doing several things | Split into named functions |
| Nested ternaries | if/else, switch or lookup table |
| Boolean flag parameters | Options object or separate functions |
| Same condition repeated | A named predicate |

**Naming**

| Signal | Remedy |
|---|---|
| Generic names (`data`, `temp`, `item`) | Name the content |
| Cryptic abbreviations | Full words unless universal (`id`, `url`) |
| Name contradicts behaviour (a `get` that mutates) | Rename to match |
| Comment restating the code | Delete it |
| Comment explaining why | Keep it |

**Redundancy**

| Signal | Remedy |
|---|---|
| 5+ duplicated lines | Shared function |
| Dead code | Remove after confirming it is dead |
| Wrapper that adds nothing | Inline it |
| Factory of factories, one-strategy strategy | Direct approach |
| Redundant type assertions | Remove |

### Step 3: Apply one change at a time

Make a change, run the tests, commit if green, revert and rethink if red. Never batch several untested simplifications. Keep refactors separate from feature or fix work. If a refactor would touch over 500 lines, automate it (codemod or AST transform) rather than editing by hand.

### Step 4: Compare the whole

Is the result genuinely easier to follow? Any new patterns foreign to the codebase? Is the diff clean? Would a teammate approve? If it is harder to review or read, revert; not every attempt succeeds.

## Examples

```typescript
// Redundant async wrapper
async function getUser(id: string) { return await userService.findById(id); }
// becomes
function getUser(id: string) { return userService.findById(id); }

// Manual filter loop becomes
const activeUsers = users.filter((u) => u.isActive);

// Redundant boolean return
return input.length > 0 && input.length < 100;
```

```python
# Nested conditionals become guard clauses
def process(data):
    if data is None:
        raise TypeError("Data is None")
    if not data.is_valid():
        raise ValueError("Invalid data")
    if not data.has_permission():
        raise PermissionError("No permission")
    return do_work(data)
```

In UI code, collapse duplicated conditional rendering into computed values. Prop drilling is a judgment call (context or composition may fit better); flag it rather than auto-refactor.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, leave it" | Hard-to-read working code is hard to fix when it breaks. |
| "Fewer lines is simpler" | A one-line nested ternary is not simpler than five clear lines. |
| "Let me tidy this unrelated code too" | Noisy diffs and regression risk. |
| "Types document it" | Types show structure, not intent. |
| "This abstraction might be useful later" | Speculative abstraction is cost; remove it, re-add when needed. |
| "The author must have had a reason" | Maybe; check blame. Often it is residue of rushed iteration. |
| "I'll refactor while adding the feature" | Separate them. |

## Red Flags

- Tests had to change to pass (behaviour likely changed)
- "Simplified" code that is longer and harder to follow
- Renames driven by taste, not conventions
- Error handling removed for tidiness
- Simplifying code you do not understand
- One large batch of unrelated simplifications
- Refactoring outside the task without being asked

## Verification

- [ ] Existing tests pass unmodified
- [ ] Build clean, no new warnings; linter and formatter pass
- [ ] Each simplification is a small reviewable change
- [ ] No unrelated changes in the diff
- [ ] Project conventions followed
- [ ] No error handling removed or weakened
- [ ] No dead code left behind
- [ ] A teammate would call it a net improvement
