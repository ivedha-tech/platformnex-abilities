# Orchestration Patterns (reference)

A catalog of endorsed ways to coordinate review personas and slash commands, plus anti-patterns. Read it before adding a command that coordinates several personas or a persona that wraps others.

Governing rule: the user (or a slash command) is the orchestrator. Personas never invoke other personas. Skills are steps inside a persona's or the main agent's workflow.

## Endorsed patterns

### 1. Direct invocation
One persona, one perspective, one artifact. The default and cheapest option; compare every orchestrated pattern against it.

```
user -> code-reviewer -> report -> user
```
Use when the work is one perspective on one artifact you can describe in a sentence ("review this PR", "find security issues in auth.ts", "what tests are missing for checkout?").

### 2. Single-persona command
A command that wraps one persona (or one skill) with the project's setup, so nobody re-explains the workflow. Examples: `/review`, `/test`, `/code-simplify`. Cost equals direct invocation. If the command body is mostly "decide which persona to call", delete it.

### 3. Parallel fan-out with merge
Several personas work the same input concurrently and report independently; the main agent merges the reports into one decision.

```
                   +-> code-reviewer ---+
/ship -> fan out --+-> security-auditor +-> merge -> go/no-go + rollback
                   +-> test-engineer ---+
```
Use when sub-tasks are independent (no shared mutable state, no ordering), each benefits from its own context window, the merge fits in the main context, and wall-clock time matters. Example: `/ship`.

Checklist before adopting:
- [ ] All sub-agents can run at once without ordering issues
- [ ] Each produces a different kind of finding, not the same finding from another angle
- [ ] The merge fits in the main agent's remaining context
- [ ] The wait is long enough for parallelism to matter

If any answer is no, fall back to pattern 1 or 2.

### 4. User-driven sequential pipeline
The user runs commands in order, carrying context or commit history between them; there is no orchestrator agent.

```
/spec -> /plan -> /build -> /test -> /review -> /ship
```
Use when steps depend on the previous output and human judgment between steps adds value. Do not automate it with a "lifecycle orchestrator": it would lose nuance in each hand-off summary, skip the human checkpoints that catch wrong-direction work early, and double token cost through paraphrasing. (`/build auto` is the one sanctioned compression, with a single approval checkpoint and hard stop conditions.)

### 5. Research isolation
When a task needs reading a large amount of material that should not fill the main context, spawn a research sub-agent that returns only a digest.

```
main agent -> research sub-agent (reads 50 files) -> digest -> main agent continues
```
Use when the result is much smaller than the input and the main agent needs room to think afterward ("find every call site of this deprecated API", "summarize what these 30 ADRs say about caching"). On Claude Code prefer the built-in read-only `Explore` subagent over a custom research persona.

## Claude Code notes

- Plugin subagents live in `agents/` at the plugin root and are discovered automatically.
- Subagents versus agent teams. Subagents report back to the main agent only and are the right fit for pattern 3. Agent teams let teammates message each other and share a task list; they are experimental, cost more (each teammate is a separate instance), and need an opt-in setting. These personas work in both modes; only the spawning context changes. Frontmatter such as `skills` and `mcpServers` applies to subagents but not to teammates, which load skills and servers from session settings.
- Platform rules: subagents cannot spawn subagents, and teams cannot nest. Persona-calls-persona and deep persona trees therefore cannot exist there by construction.
- Built-in subagents: `Explore` (read-only search), `Plan` (read-only research in plan mode), `general-purpose`. Layer specialist personas on top rather than redefining them.
- Plugin agents ignore `hooks`, `mcpServers` and `permissionMode` frontmatter.
- To fan out in parallel, issue all Agent calls in a single assistant turn; separate turns run sequentially.

## Worked example: agent team for competing-hypothesis debugging

Scenario: checkout hangs for about 30 seconds roughly once in 50 sessions, no errors in logs, started after last week's release. Plausible, mutually exclusive causes: a race in the new payment confirmation flow; an auth check that occasionally falls through to a slow synchronous call; a missing index on a query that grows with cart size; a flaky third-party API retried silently by its SDK.

A single agent picks the first plausible theory and stops. A `/ship`-style fan-out gives three independent reports that never meet, so nothing rules out the wrong theories. An agent team lets investigators try to disprove each other, and the theory that survives is much more likely the real cause.

| | `/ship` (subagents) | Agent team |
|---|---|---|
| Members see | The same diff through different lenses | A shared task list and each other's messages |
| Output | Three reports merged into one verdict | A debate converging on a root cause |
| Right when | You want a verdict on a known artifact | You must find the artifact among hypotheses |

`/ship` is a verdict; a team is an investigation. Trigger it in natural language in the lead session, for example:

```
Checkout hangs for ~30s intermittently after last week's release; no errors.
Create an agent team to debug with competing hypotheses, using the existing agent types:
- code-reviewer: race conditions and blocking calls in the checkout path
- security-auditor: auth checks, session handling, recently added synchronous network calls
- test-engineer: tests that would distinguish the hypotheses, and coverage gaps in checkout
Have them message each other to challenge theories. Converge only when two
teammates agree they can disprove the others'.
```

When done, tell the lead to clean up the team (always through the lead). Expect noticeably higher cost than a fan-out; it is worth it when a wrong fix in production is expensive, not for routine PR review. Do not rebuild this as a `/debug` command that fans out subagents: they cannot message each other, so the debate disappears. Document the prompt as a snippet instead.

When not to use a team: a verdict on a known diff (use `/ship`); one specialist view on one artifact (direct invocation); a sequential lifecycle (pattern 4); read-heavy research with a small digest (`Explore`).

## Anti-patterns

- **A. Router persona.** A persona whose job is choosing which persona to call. It adds two paraphrasing hops, loses information, roughly doubles tokens, and duplicates what commands and the router skill already do. Instead: refine commands and the skill routing.
- **B. Persona that calls a persona.** A reviewer invoking a security auditor when it sees auth code. It defeats single-perspective design, loses context in the hand-off, multiplies failure modes, and hides cost. Instead: recommend the follow-up pass in the report and let the user or a command run it.
- **C. Sequential orchestrator that paraphrases.** An agent that runs the define, plan and build commands for the user. It drops human checkpoints, accumulates drift, doubles cost, and removes agency where judgment matters. Instead: keep the user as orchestrator and document the recommended sequence.
- **D. Deep persona trees.** A command calling a coordinator that calls a coordinator that calls a reviewer. Each layer adds latency and tokens with no decision value and leaf personas lose context. Instead: keep depth at one (command to personas) and merge in the main agent.

## Decision flow

```
Is the work one perspective on one artifact?
+-- Yes: direct invocation. Stop.
+-- No: will the same composition repeat?
    +-- No: direct invocation, ad hoc. Stop.
    +-- Yes: are the sub-tasks independent?
        +-- No: user-driven sequential commands (pattern 4).
        +-- Yes: parallel fan-out with merge (pattern 3); validate against the checklist.
                 If any check fails, use a single-persona command (pattern 2).
```

## Adding a new pattern to this catalog

Only after you have used it at least twice in real work, can name a concrete artifact that demonstrates it, can explain why an existing pattern would not have worked, and can describe the anti-pattern people will mistakenly build instead. Premature entries become aspirational documentation nobody follows.
