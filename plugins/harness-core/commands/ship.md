---
description: Run the pre-launch checklist via parallel specialist personas, then synthesize a go/no-go decision
disable-model-invocation: true
---

Invoke the harness-ship:shipping-and-launch skill.

`/ship` is a fan-out orchestrator. It runs three specialist personas in parallel on the current change, then merges their reports into one go/no-go decision with a rollback plan. The personas are independent (no shared state, no ordering), which is what makes parallel execution safe.

## Phase A: parallel fan-out

Spawn three subagents concurrently with the Agent tool. Issue all three calls in a single assistant turn so they run in parallel; sequential calls defeat the purpose.

On Claude Code, pass `subagent_type` matching each persona's `name` (in a plugin install it may be namespaced, for example `harness-core:code-reviewer`):

1. `code-reviewer`: five-axis review (correctness, readability, architecture, security, performance) of the staged changes or recent commits, in the standard review template.
2. `security-auditor`: vulnerability and threat-model pass covering the OWASP Top 10, secrets handling, authentication and authorization, and dependency CVEs, in the standard audit report.
3. `test-engineer`: coverage analysis of the change, finding gaps in happy path, edge cases, error paths and concurrency, in the standard analysis format.

Without an Agent tool, run each persona's instructions one after another and treat the outputs as if returned in parallel; the merge still works.

Constraints of the subagent model:
- Subagents cannot spawn subagents; do not let one persona delegate to another.
- Each gets its own context window and returns only its report.
- If you need teammates that talk to each other, use agent teams (see harness-core's orchestration-patterns reference).

Persona resolution: if the user has defined their own `code-reviewer`, `security-auditor` or `test-engineer` in `.claude/agents/` or `~/.claude/agents/`, those take precedence over the plugin's versions, so `/ship` picks up their customizations.

## Phase B: merge in the main context

When all three reports are back, the main agent (not a persona) synthesizes them:

1. **Code quality**: aggregate Critical and Required findings from `code-reviewer` plus any failing tests, lint or build output; de-duplicate.
2. **Security**: promote Critical and High `security-auditor` findings to launch blockers; cross-check against the reviewer's security axis.
3. **Performance**: take the reviewer's performance axis; check Core Web Vitals if applicable.
4. **Accessibility**: keyboard navigation, screen reader support, contrast. No persona covers this; check directly with harness-core's accessibility checklist.
5. **Infrastructure**: environment variables, migrations, monitoring, feature flags. Verify directly.
6. **Documentation**: README, ADRs, changelog. Verify directly.

## Phase C: decision and rollback

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [persona: Critical finding + file:line]

### Recommended fixes (should fix before ship)
- [persona: important finding + file:line]

### Acknowledged risks (shipping anyway)
- [risk + mitigation]

### Rollback plan
- Trigger conditions: [signals that prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]

### Specialist reports (full)
- [code-reviewer] [security-auditor] [test-engineer]
```

## Rules

1. The Phase A personas run in parallel, never sequentially.
2. Personas do not call each other; the main agent merges in Phase B.
3. A rollback plan is mandatory before any GO.
4. Any Critical finding means NO-GO unless the user explicitly accepts the risk.
5. Skip the fan-out only if all of these hold: the change touches 2 files or fewer, the diff is under 50 lines, and it does not touch auth, payments, data access, or config and environment. Otherwise fan out; `/ship` is for production-bound changes, and a small diff with a non-trivial blast radius still gets the parallel review.
