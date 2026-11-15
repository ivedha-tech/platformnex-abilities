#!/usr/bin/env bash
# Gate check, run by `make check` and by the test build.
# A branch with a `feat:` commit needs a PRD (gate G1): either it adds or changes
# a file in docs/specs/, or a commit says `PRD: docs/specs/<file>.md` for a PRD
# that already exists, or a commit says `Skip-PRD: <reason>` (small or urgent
# changes; the reason is read in review).
# Compares against $BASE_REF, else origin/main, else main. Skips with a note when
# there is no base branch or no history to compare (for example a shallow clone).
set -euo pipefail

git rev-parse --git-dir >/dev/null 2>&1 || { echo "gates: not a git checkout, skipped"; exit 0; }

base="${BASE_REF:-}"
if [ -z "$base" ]; then
  for c in origin/main main; do
    if git rev-parse --verify -q "$c" >/dev/null; then base="$c"; break; fi
  done
fi
[ -n "$base" ] || { echo "gates: no base branch found, skipped"; exit 0; }
git merge-base "$base" HEAD >/dev/null 2>&1 || { echo "gates: no shared history with $base (shallow clone?), skipped"; exit 0; }

range="$base..HEAD"
if ! git log --format=%s "$range" | grep -Eq '^feat(\([^)]*\))?!?:'; then
  echo "gates: no feat commits in $range, nothing to check"
  exit 0
fi

bodies="$(git log --format=%B "$range")"

if printf '%s\n' "$bodies" | grep -Eiq '^Skip-PRD:[[:space:]]*[^[:space:]]'; then
  echo "gates: PRD skipped with a stated reason (reviewers will read it)"
  exit 0
fi

if git diff --name-only "$range" | grep -Eq '^docs/specs/.+\.md$'; then
  echo "gates: PRD present in this change"
  exit 0
fi

ref="$(printf '%s\n' "$bodies" | sed -nE 's/^PRD:[[:space:]]*(docs\/specs\/[^[:space:]]+\.md).*/\1/p' | head -1)"
if [ -n "$ref" ] && git cat-file -e "HEAD:$ref" 2>/dev/null; then
  echo "gates: PRD $ref exists"
  exit 0
fi

cat >&2 <<'MSG'
gates: this branch has a feat: commit but no PRD (gate G1).
  - Write one with the prd skill (docs/specs/<slug>.md), or
  - add a commit trailer  `PRD: docs/specs/<file>.md`  for an existing PRD, or
  - add a commit trailer  `Skip-PRD: <why this needs none>`  for a small change.
MSG
exit 1
