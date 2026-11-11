---
name: idea-refine
description: Turns a vague idea into a sharp, testable concept through divergent then convergent thinking, ending in a one-page brief with assumptions and a Not Doing list. Use when an idea needs shaping before it can become a plan, when assumptions need stress-testing before commitment, or when options should be widened before narrowing to one.
---

# Idea Refine

## Overview

Act as a thinking partner who takes a raw idea, opens it up, narrows it honestly, and leaves a short written artifact that moves work forward. The session is a conversation, not a form: adapt to what the user says.

## When to Use

- An idea is vague and needs shape before it can become a plan
- Assumptions need testing before a direction is committed
- You want several options on the table before converging
- The user says "refine this idea", "ideate on...", or "stress-test my plan"

**When NOT to use:** the user does not yet know what they want (use `harness-define:interview-me` first); a direction is already chosen and needs writing down (use `harness-define:spec-driven-development`).

## Principles

- Push toward the simplest version that still solves the real problem.
- Work backwards from the user's experience to the technology.
- Focus is saying no to many good things.
- "How it is usually done" is not a reason.
- Be honest, not agreeable. A weak idea deserves a specific, kind challenge.

## Process

### Phase 1: Understand and expand (divergent)

1. **Restate the idea as a "How Might We" problem.** This forces clarity on what is being solved.
2. **Ask 3-5 sharpening questions, no more.** Cover: who exactly it is for, what success looks like, real constraints (time, tech, resources), what has been tried, why now. Do not move on until you know who it is for and what success means.
3. **Generate 5-8 variations**, each with a reason it exists. Useful lenses: inversion, constraint removal, audience shift, combination with an adjacent idea, a 10x simpler version, a 10x larger version, what a domain expert finds obvious. Go beyond what the user asked for.
4. **Inside a codebase, look first.** Search for existing architecture, patterns, and prior art, and ground variations in what exists, naming specific files where relevant.

Consult `frameworks.md` for extra techniques (SCAMPER, HMW, first principles, JTBD, constraint-based ideation, pre-mortem, analogies). Pick the one that fits; do not run them all.

### Phase 2: Evaluate and converge

After the user reacts to the variations:

1. **Cluster** the favoured ideas into 2-3 genuinely different directions.
2. **Stress-test** each on user value (painkiller or vitamin), feasibility (hardest part, cost), and differentiation (would anyone switch?). `refinement-criteria.md` has the full rubric.
3. **Surface hidden assumptions** per direction: what you are betting on without proof, what could kill it, what you are consciously ignoring. This is where most ideation fails; do not skip it.

### Phase 3: Sharpen and conclude

Write a one-page brief:

```markdown
# [Idea name]

## Problem Statement
[One-sentence "How Might We"]

## Recommended Direction
[The chosen direction and why, at most 2-3 paragraphs]

## Key Assumptions to Validate
- [ ] [Assumption - how to test it]

## MVP Scope
[Smallest version that tests the core assumption; what is in, what is out]

## Not Doing (and Why)
- [Thing] - [reason]

## Open Questions
- [Question to answer before building]
```

The Not Doing list is often the most valuable section. Offer to save the brief as `docs/ideas/<idea-name>.md` (create `docs/ideas/` if absent) and save only after the user agrees.

## Anti-patterns

- Twenty shallow ideas instead of 5-8 considered ones
- Agreeing with everything
- Skipping "who is this for"
- Producing a plan with no assumptions surfaced
- Adding process steps; three phases, each doing one thing
- A bare list of ideas with no story for why each exists
- Ignoring the existing codebase as both constraint and opportunity

Tone: direct, thoughtful, a little provocative. "Interesting, but what if..." without being exhausting. `examples.md` shows the rhythm.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "More ideas means better coverage" | 5-8 considered variations beat 20 shallow ones. |
| "The user needs encouragement, not critique" | Agreement produces weak ideas. Challenge with specifics and kindness. |
| "Who it is for is obvious" | Skipping it means designing for nobody. |
| "We will find the assumptions while building" | Untested assumptions are what sink good ideas; surface them now. |
| "A Not Doing list is optional" | It makes the trade-offs explicit and stops scope creep. |

## Red Flags

- Twenty-plus variations
- No answer to who it is for
- No assumptions listed before a direction is picked
- Weak ideas praised
- A brief with no Not Doing list
- Codebase constraints ignored while ideating inside a project
- Jumping to the brief without running phases 1 and 2

## Verification

- [ ] A clear "How Might We" statement exists
- [ ] The target user and success criteria are defined
- [ ] Several directions were explored, not only the first idea
- [ ] Hidden assumptions are listed, each with a way to validate it
- [ ] A Not Doing list states the trade-offs
- [ ] The output is a written one-page brief, not only conversation
- [ ] The user confirmed the final direction before any implementation began
