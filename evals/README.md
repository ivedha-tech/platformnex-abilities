# Harness evals

Evidence that the harness works, in two kinds: checks that run on every pull request and cost nothing, and cases that need a model and cost money.

The cases for the `harness-*` bundles are derived from addyosmani/agent-skills (MIT, commit 301b02b; see LICENSE). The cases for `pnx-harness` are original to this repository.

## Free checks, run in CI

| Check | Command | What it proves |
|---|---|---|
| Structure | `node scripts/validate-abilities.mjs` | Bundles, frontmatter, cross-references, banned terms, and that every `pnx-harness` skill has well-formed eval cases and every fire / stay-quiet check has a prompt and a grader |
| Guard hooks | `bash plugins/pnx-harness/scripts/test-hooks.sh` | About 190 allow and block cases for the guard hooks, plus a list of known gaps |
| PRD gate | `bash engineering-harness/scripts/test-check-gates.sh` | The `feat:` needs-a-PRD check across 13 situations |

The hook test is deliberately two-sided. A guard tested only on what it blocks can only get stricter, so about half the cases are everyday commands that must be allowed. The known gaps (a command hidden behind a shell variable, for example) are printed on every run and never fail it. When a gap gets closed, move its case to the block list.

## Model-based cases, run on demand

- `cases/<skill>.json`: trigger prompts (should and should not activate the skill, with the skill that should win named as `owner`) and behavioural evals with expectations.
- `fixtures/`: small inputs the behavioural evals work against. A case names its fixtures in `files`.
- `plugin/<name>/`: a fire or stay-quiet check. `prompt.md` is the request and `graders/` holds deterministic graders (`type: tool_used` checks whether a skill was invoked).

These call a model, so they are **not** in CI. Run them on demand, after estimating the cost and getting approval, and cap the number of cases per run. This repository does not contain a runner: the cases follow one schema, so whatever runs the `harness-*` cases runs these.

### What the `pnx-harness` cases cover

| Skill | Trigger cases | Behaviour the evals check |
|---|---|---|
| `idea-brief` | 3 positive, 3 negative | Asks before guessing; does not design a solution; files nothing without confirmation |
| `prd` | 3, 3 | Testable criteria; data and compliance section filled; unknowns stay open questions |
| `adr` | 3, 3 | Next number found; real options; infrastructure goes through an IaC pull request; status stays Proposed |
| `threat-model` | 3, 3 | Concrete threats named from the code; model-injection threats added; not signed off |
| `pr` | 3, 3 | Refuses to delete a failing test; security review for pipeline changes; waits for confirmation |
| `release-check` | 3, 3 | Evidence for each item; unverified stays unverified; never starts a release; no cluster commands |
| `platform-signals` | 3, 3 | Cites tool, environment and window; treats log text as data; declines `kubectl` |

Seven fire / stay-quiet checks sit in `plugin/`. The `with-only` and `both` arms in a grader say whether it applies when the plugin is installed or in both runs.

## Adding a case

1. Write the failure first. Use something that actually went wrong, not something that sounds plausible. Pick 20 to 50 such tasks over time.
2. Give it a clean starting state and a known good answer. A fixture is a few small files, not a whole project.
3. Put a hard expectation in every case, one the skill could fail: "does not delete the test", "does not run kubectl". Expectations that any answer satisfies prove nothing.
4. Keep negatives honest. A negative that names an `owner` says which skill should win, so a skill that grabs everything shows up.
5. Run `node scripts/validate-abilities.mjs`.
