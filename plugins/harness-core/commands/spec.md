---
description: Start spec-driven development - write a structured specification before any code
disable-model-invocation: true
---

Invoke the harness-define:spec-driven-development skill.

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Boundaries: what to always do, what to ask about first, what never to do

Then write a structured spec covering six areas: objective, commands, project structure, code style, testing strategy, and boundaries.

If the request bundles several independently testable capabilities, first propose a capability map (module ids, dependency direction, build order) as the skill's Phase 0 describes, get it approved, then spec each module in dependency order.

Save the spec as SPEC.md at the project root and confirm it with the user before moving on.
