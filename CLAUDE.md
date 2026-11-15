# platformnex-abilities

The organisation's Claude Code plugin marketplace, plus the engineering kit in `engineering-harness/`. Merging a pull request here changes behaviour for everyone who receives the marketplace.

## Commands

| Task | Command |
|---|---|
| Validate the harness bundles | `node scripts/validate-abilities.mjs` |
| Guard-hook self-test | `bash plugins/pnx-harness/scripts/test-hooks.sh` |
| Start-up notice test | `bash plugins/pnx-harness/scripts/test-session-info.sh` |
| PRD gate test | `bash engineering-harness/scripts/test-check-gates.sh` |
| Validate one bundle | `node scripts/validate-abilities.mjs --bundle harness-ship` |

Run all three before opening a pull request. CI runs them on Node 20. The model-based cases in `evals/` call a model and cost money: do not run them unless asked, and ask about the cost first. Every `pnx-harness` skill needs a `evals/cases/<skill>.json`; the validator fails without one.

## Layout

- `.claude-plugin/marketplace.json` lists every plugin with its source and version.
- `plugins/<name>/` holds a plugin: `.claude-plugin/plugin.json`, then `skills/`, `agents/`, `commands/`, `hooks/`, `scripts/`.
- `engineering-harness/` is the kit (policies, compliance, bootstrap scripts, Terraform, service template). It is not a plugin and CI does not check it.
- `scripts/validate-abilities.mjs` and `evals/` support the `harness-*` bundles.

## Rules

- Every change is a pull request. Never push to `main`, merge, or approve. Say when a change removes a plugin: removal is org-wide.
- Bump `version` in `plugin.json` and in `marketplace.json` together. The validator fails if they differ.
- `harness-*` bundles stay tool-neutral: no `hooks/` directory, no terms that name PlatformNEX or another vendor's tool, and `LICENSE` plus `NOTICE.md` present. Put PlatformNEX specifics in `pnx-harness` or `pnx-fast-dev`.
- A skill is `skills/<kebab-name>/SKILL.md` whose frontmatter `name` equals its folder and whose `description` says "Use when ...". It needs Overview, When to Use and Verification sections and stays under 500 lines.
- A change to a guard hook adds both an allow case and a block case to `test-hooks.sh`. A test file that only lists blocked commands lets the guard drift towards blocking everything.
- Keep skills and this file short. Do not add generated or speculative rules; a rule needs a reason or a test.
- Third-party plugins are pinned to a commit sha. Do not point one at a branch.
- No secrets, tokens, customer data or production names in any file.
- Do not edit `.github/workflows/` unless asked.

## The kit

Treat `engineering-harness/` as unproven: its scripts and Terraform have never run against a real organisation, so never run them for real. `bootstrap-github.sh --dry-run`, `new-service.sh --dry-run` and `terraform validate` are fine. Never `terraform apply`. Its README says what is tested and what is not.

## Gotchas

- Skills from a plugin are namespaced: `pnx-harness:prd`, not `prd`.
- `pnx-harness` guard hooks run only where the plugin is enabled in managed settings. Installing it by hand is believed not to be enough.
- `pnx-harness` blocks edits to `.github/workflows/*`, `CODEOWNERS` and files outside the repository. If it blocks legitimate work here, stop and tell the human.
