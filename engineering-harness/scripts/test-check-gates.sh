#!/usr/bin/env bash
# Test for the PRD gate (repo-template/scripts/check-gates.sh). Builds throwaway git repositories and
# checks the exit code for each situation. No network, nothing outside a temp directory.
#   bash engineering-harness/scripts/test-check-gates.sh
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
gate="$here/../repo-template/scripts/check-gates.sh"
[ -f "$gate" ] || { echo "missing $gate" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0
count=0

repo() { # repo <name>: a repo with one commit on main
  local d="$tmp/$1"
  mkdir -p "$d/docs/specs" "$d/src" && cd "$d" || exit 1
  git init -q -b main
  git config user.email t@example.com && git config user.name t && git config commit.gpgsign false
  echo a > src/a && git add -A && git commit -q -m "chore: init"
}
commit() { # commit <file> <message...>
  local f="$1"; shift
  echo "$RANDOM" >> "$f" && git add -A && git commit -q -m "$*"
}
expect() { # expect <0|1> <label>
  local want="$1" label="$2" rc
  bash "$gate" >/dev/null 2>&1; rc=$?
  count=$((count + 1))
  if [ "$rc" = "$want" ]; then printf 'ok    exit %s  %s\n' "$want" "$label"
  else printf 'FAIL  wanted exit %s, got %s: %s\n' "$want" "$rc" "$label"; fail=1; fi
}

repo a; expect 0 "on main with nothing ahead"
repo b; git switch -q -c b; commit src/b "fix: tweak"; expect 0 "fix only"
repo c; git switch -q -c b; commit src/b "feat: export"; expect 1 "feat without a PRD"
repo d; git switch -q -c b; commit src/b "feat: export"; commit docs/specs/export.md "docs: prd"; expect 0 "feat with a new spec file"
repo e; git switch -q -c b; commit src/b "feat(api): export"; commit docs/specs/export.md "docs: update spec"; expect 0 "scoped feat with a changed spec file"
repo f; git switch -q -c b; commit src/b "feat: other

Skip-PRD: one-line config default"; expect 0 "Skip-PRD with a reason"
repo g; git switch -q -c b; commit src/b "feat: third

Skip-PRD:"; expect 1 "Skip-PRD with no reason"
repo h; git switch -q -c b; echo p > docs/specs/export.md; git add -A; git commit -q -m "docs: prd"; git switch -q main; git merge -q --ff-only b
git switch -q -c c; commit src/c "feat: fourth

PRD: docs/specs/export.md"; expect 0 "PRD reference to an existing file"
repo i; git switch -q -c b; commit src/b "feat: fourth

PRD: docs/specs/missing.md"; expect 1 "PRD reference to a missing file"
repo j; git switch -q -c b; commit src/b "feat!: breaking export"; expect 1 "breaking feat without a PRD"
repo k; git switch -q -c b; commit src/b "feature: not a conventional type"; expect 0 "a subject that only looks like feat"
d="$tmp/nogit"; mkdir -p "$d" && cd "$d" && expect 0 "outside a git checkout"
repo l; git switch -q -c b; commit src/b "feat: export"; BASE_REF=main expect 1 "explicit BASE_REF still gates"

if [ $fail -eq 0 ]; then echo "All $count gate tests passed."; else echo "Some gate tests FAILED."; fi
exit $fail
