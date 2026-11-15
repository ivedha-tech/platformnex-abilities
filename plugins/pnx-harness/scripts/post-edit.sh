#!/usr/bin/env bash
# PostToolUse hook for Edit / Write. Formats the edited file. Never blocks.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
path="$(jq -r '.tool_input.file_path // empty')"
[ -n "$path" ] && [ -f "$path" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
ruff="ruff"
[ -x "$root/.venv/bin/ruff" ] && ruff="$root/.venv/bin/ruff"

case "$path" in
  *.py)
    if command -v "$ruff" >/dev/null 2>&1; then
      "$ruff" format --quiet "$path" || true
      "$ruff" check --quiet --fix "$path" || true
    fi
    ;;
esac
exit 0
