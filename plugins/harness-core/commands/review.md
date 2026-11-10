---
description: Conduct a five-axis code review - correctness, readability, architecture, security, performance
disable-model-invocation: true
---

Invoke the harness-verify:code-review-and-quality skill.

Review the current changes (staged or recent commits) on five axes:

1. **Correctness**: matches the spec? Edge cases handled? Tests adequate?
2. **Readability**: clear names, straightforward logic, well organized?
3. **Architecture**: follows existing patterns, clean boundaries, right abstraction level?
4. **Security**: input validated, secrets safe, auth checked? (use harness-verify:security-and-hardening)
5. **Performance**: no N+1 queries, no unbounded operations? (use harness-verify:performance-optimization)

Label findings Critical, Required, Optional, or Nit. Output a structured review with file:line references and a fix recommendation for each Critical and Required finding.
