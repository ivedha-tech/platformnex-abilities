#!/usr/bin/env bash
# Shared by the guard hooks. Reads one field from the hook's JSON on stdin.
# Uses jq when present and python3 otherwise, so a machine without jq is still guarded.

# json_field <jq-style alternatives, e.g. "command" or "file_path notebook_path">
# Prints the first non-empty .tool_input.<key>. Returns 3 when no JSON reader exists.
json_field() {
  local keys="$*" input
  input="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    local expr="" k
    for k in $keys; do expr="${expr:+$expr // }.tool_input.$k"; done
    printf '%s' "$input" | jq -r "$expr // empty"
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$input" | python3 -c '
import json, sys
try:
    ti = json.load(sys.stdin).get("tool_input") or {}
except Exception:
    sys.exit(0)
for k in sys.argv[1:]:
    v = ti.get(k)
    if v:
        sys.stdout.write(str(v))
        break
' $keys
  else
    return 3
  fi
}
