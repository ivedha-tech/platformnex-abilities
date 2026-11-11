---
description: Break work into small verifiable tasks with acceptance criteria and dependency order
disable-model-invocation: true
---

Invoke the harness-define:planning-and-task-breakdown skill.

Read the existing spec (SPEC.md or equivalent) and the relevant parts of the codebase. Then:

1. Work in plan mode: read only, no code changes
2. Map the dependency graph between components
3. Slice vertically (one complete path per task, not horizontal layers)
4. Write each task with acceptance criteria and a verification step
5. Add checkpoints between phases
6. Present the plan for human review

Save the plan to tasks/plan.md and the task list to tasks/todo.md.

If tasks/plan.md or tasks/todo.md already holds unchecked tasks for different work, stop and ask before writing. Never silently overwrite an incomplete plan.
