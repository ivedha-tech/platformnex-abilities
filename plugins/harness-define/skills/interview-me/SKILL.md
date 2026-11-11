---
name: interview-me
description: Draws out what the user actually wants through a one-question-at-a-time interview, each question carrying the agent's own guess, until the agent can predict the user's answers. Ends with a confirmed statement of intent. Use when a request is underspecified ("build me X" with no audience or reason), when the user asks to be interviewed or stress-tested, or when you notice yourself silently filling in gaps before any spec, plan, or code exists.
---

# Interview Me

## Overview

People ask for what is conventional, not always for what they need. "A dashboard" is what one asks for; "make it faster" arrives with no target. The gap between the ask and the need is cheapest to close before any plan or code exists. After work starts, switching costs rise and the user talks themselves into accepting a near miss.

This skill closes that gap with a short interview: one question at a time, each with your best guess attached, continuing until you can predict what the user will say next. It sits upstream of `harness-define:idea-refine` (variations on a known intent), `harness-define:spec-driven-development` (writing requirements down), and `harness-build:doubt-driven-development` (challenging a plan after it is drafted).

## When to Use

- The request lacks at least one of: who it is for, why it is wanted now, what success looks like, the binding constraint
- The request is a convention ("build me X", "make it faster") that you cannot unpack without guessing
- Two reasonable values pull against each other (simplicity vs flexibility, cost vs speed) and the user has not chosen
- The user says "interview me", "grill me", "are we sure?", or "stress-test my thinking"

**When NOT to use:**

- The ask is unambiguous and self-contained (rename a variable, fix a typo)
- The user explicitly wants speed over verification
- Pure questions ("how does X work?") and mechanical edits
- You already have about 95% confidence (apply the stop test below honestly before deciding)

**Needs a live user.** Do not run this in CI, scheduled jobs, or unattended loops. If the ask is underspecified there, report it as a blocker rather than guessing.

## The Process

### 1. State a hypothesis and a confidence number

Before asking anything, write one sentence on what you think the user wants, with a percentage:

```
HYPOTHESIS: You want a quick answer to "how are we doing?" for standup; "dashboard" was the first form that came to mind.
CONFIDENCE: ~30% - unknown: the audience, what "metrics" means here, what success looks like
```

If you could not predict the user's reaction to your next three questions, your number is too high. Below about 70%, always say what is missing so the user knows what the interview must resolve.

### 2. Ask one question, with a guess

```
Q: <one focused question>
GUESS: <your expected answer and why>
```

Wait for the reply before the next question.

- One at a time, because later questions depend on earlier answers, batches get skimmed, and the user's attention is finite.
- With a guess, because reacting to a wrong guess is faster than composing an answer, and because the guess exposes your assumptions, which is what the interview is for.
- Guard against agreeable users who simply nod: stay visibly willing to be wrong, and sometimes guess in the direction you expect them to push back on.

### 3. Listen for "should want" versus "want"

Be suspicious of answers that sound like what a thoughtful person would say:

- Best-practice vocabulary with no specifics ("scalable", "clean", "modern")
- Deference to convention ("the standard way", "how most apps do it")
- "I should probably...", "I think I'm supposed to..."

Probe with: "If you did not have to justify this to anyone, what would you actually want?" That one question often outweighs five others.

### 4. Restate the intent

When confidence is high, write it back in the user's words, 5-8 lines, easy to correct line by line:

```
Here is what I think you want:

- Outcome:      <one line>
- User:         <who benefits>
- Why now:      <what changed>
- Success:      <how we will know>
- Constraint:   <the binding limit>
- Out of scope: <what we are not doing>

Yes / no / refine?
```

"Out of scope" is mandatory; half of misalignment is silent disagreement about non-goals.

### 5. Require an explicit yes

These are not a yes:

- "Whatever you think is best": the user is delegating, so they lack confidence too. Re-ask as a choice between two concrete options.
- "Sounds good" or "sure, let's go": often a polite exit. Ask what they would refine.
- Silence, then "okay, start": the user gave up on the interview; they did not converge. Ask whether you missed something.

Fold corrections in, restate, repeat until you get a clear yes.

### 6. Stop the turn

After the yes: deliver the confirmed statement of intent, offer next steps (save it as `docs/intent/<topic>.md`, move to `harness-define:spec-driven-development`, or to `harness-define:idea-refine` if scope is still open), and **stop**. Do not call tools or begin downstream work in the same turn. Save the file only if the user agrees.

### The stop test

You are done interviewing when you can say yes to: "Can I predict the user's reaction to the next three questions I would ask?" If you are several rounds in and still cannot, tell the user so ("I have asked N questions and still cannot predict you; something foundational is missing. Step back?") instead of grinding on.

## Example

Without the skill:

```
User:  build me a dashboard for our metrics
Agent: <starts choosing chart libraries>
```

With it:

```
Agent:
HYPOTHESIS: You want to answer "how are we doing?" and "dashboard" is the conventional shape.
CONFIDENCE: ~30% - unknown: audience, which metrics, success

Q:     When you ask "how are we doing?", who is asking: you, the team in standup, or someone up the chain?
GUESS: The team in standup, since "we" usually scopes that way.

User: Actually just me. I lose track of which experiments are running and their early signal.

Agent: Updated read: a personal experiment tracker, not a team dashboard. ~60% - unknown: what "early signal" means.
Q:     Is the gap that you do not know which experiments exist, or that you cannot see their results together?
GUESS: The second: the list exists, results are scattered.

User: The first. I have no list at all.
```

Two questions in, the deliverable changed from a dashboard to a list. Different artifact, different scope.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The ask is clear enough" | If you cannot state the desired outcome in one sentence now, it is not clear. |
| "Questions waste their time" | A few targeted questions cost minutes; building the wrong thing costs far more, and the user pays. |
| "I will figure it out while building" | Discovery during implementation is rework. |
| "They said whatever I think, so I decide" | That is delegation, not a decision. Offer two concrete options. |
| "I should offer a menu of options" | A menu helps when the user knows what they want. Before that, options widen the search; questions narrow it. |
| "Attaching a guess is leading them" | Leading is the point; reacting is quicker than composing. The real risk is sycophancy, which you counter by being willing to be wrong. |
| "We have talked enough" | Run the stop test. If you cannot predict the next three reactions, you are not done. |
| "They said yes, so we are done" | A yes to a vague restate is hollow. Restate concretely and reconfirm. |

## Red Flags

- Several questions in one message (batching)
- A question with no hypothesis attached (surveying)
- Treating "whatever you think" as a final answer
- Producing a spec, plan, or tasks before an explicit yes on the restate
- Starting downstream work in the same turn as the confirmation
- Questions about "best practice" instead of "what do you want"
- Accepting buzzwords as goals without probing
- Three rounds with no visible rise in confidence: reframe
- A confidence number under 70% with no stated reason
- Saving the intent file before the user confirmed
- A restate with no "Out of scope" line

## Verification

- [ ] The first turn stated a hypothesis and a confidence number
- [ ] Every number under about 70% came with what is still unknown
- [ ] Questions came one at a time, each with a guess
- [ ] A "what would you want without justifying it" probe ran after any convention- or buzzword-flavoured answer
- [ ] A restate (Outcome, User, Why now, Success, Constraint, Out of scope) was written back
- [ ] The user gave an explicit yes, not "sounds good" or silence
- [ ] At the stop, you could predict reactions to the next three questions
- [ ] The turn ended at confirmation with no tools or downstream work started
- [ ] Any handoff was framed around the confirmed intent, not the original vague ask
