# Harness evals

Cases and fixtures for the `harness-*` bundles, derived from addyosmani/agent-skills (MIT, commit 301b02b; see LICENSE).

- `cases/<skill>.json`: trigger prompts (should / should not activate the skill) and behavioural evals with expectations.
- `fixtures/`: small projects the behavioural evals work against.
- `plugin/`: fire / stay-quiet checks with graders.

## Running
Structural validation (free, runs in CI): `node scripts/validate-abilities.mjs`.

Running the cases against a model makes paid model calls, so it is **not** in CI. Run it on demand, after estimating the cost
and getting approval, and cap the number of cases per run.
