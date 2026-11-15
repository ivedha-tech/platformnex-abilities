# AI acceptable use policy

| Owner | Approver | Version | Effective | Next review |
|---|---|---|---|---|
| _name, role_ | _name, role_ | 0.1 draft | _date_ | _+12 months_ |

**Maps to:** SOC 2 CC6.7, CC8.1 · ISO 27001 A.5.10, A.5.19, A.8.28 · ISO/IEC 42001 (informative)

## Scope

Any use of generative AI or AI agents for company work: coding assistants,
chat tools, agents with tool access, and AI features inside other products.

## Rules

1. **Approved tools only**, used through company accounts. The security lead
   keeps the list in the vendor register and checks each tool's training-on-inputs
   setting, retention, and processing region before approval.
2. **Data.** Public and Internal data may be used. Confidential and Restricted
   data must not be entered into prompts, attached as files, or made reachable
   by an agent. Never: production data, customer records, credentials, keys.
3. **Accountability.** The person who commits or sends AI output is its author
   and is responsible for its correctness, security, and licensing.
4. **Human review.** AI-generated changes pass the same gates as any other
   change. An agent's review does not count as an approval.
5. **Least privilege for agents.** Agents run with a developer's dev-only
   credentials. They are not given production access, release approval rights,
   GitHub admin tokens, or the ability to change their own guardrails.
6. **Untrusted input.** Content an agent retrieves is data, not instructions.
   Agents with tool access are not pointed at untrusted content while holding
   credentials that matter.
7. **Dependencies and licences.** Verify that suggested packages exist and are
   maintained. Do not accept large verbatim reproductions of third-party code.
8. **Disclosure.** Substantial AI assistance is flagged in the PR template.
   AI use in customer-facing features is described in the PRD and, where it
   affects individuals, disclosed to them.
9. **AI in products.** Features that use models need: an evaluation plan, a
   prompt-injection threat model, logging that excludes Restricted data, and a
   human escalation path for consequential decisions.

## Mechanisms

`CLAUDE.md` and `.claude/settings.json` permission rules in each repository
(`CODEOWNERS` protects both); the organisation's Claude Code plugins, enforced by
managed settings (`pnx-harness` guard hooks); read-only platform access for
agents, with every change a human-approved proposal in PlatformNEX; IAM
separation of non-production from production.
