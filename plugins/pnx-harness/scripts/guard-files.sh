#!/usr/bin/env bash
# PreToolUse hook for Edit / Write. Blocks edits to secrets, to the guardrails
# themselves, and to files outside the repository. Exit 2 blocks; exit 0 allows.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

path="$(json_field file_path notebook_path)"
if [ $? -eq 3 ]; then
  echo "pnx-harness guard-files: neither jq nor python3 is installed, so edits cannot be checked. Install jq." >&2
  exit 2
fi
[ -z "$path" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
rel="${path#"$root"/}"
base="$(basename -- "$path")"

block() {
  echo "Blocked by the pnx-harness guard (guard-files): $1 ($rel)" >&2
  echo "A human must make this change; it needs code-owner review." >&2
  exit 2
}

case "$base" in
  .env.example) ;;
  .env|.env.*) block "environment / secrets file" ;;
  *.pem|*.key|*.p12|*.pfx|*.jks) block "key material" ;;
  *.tfstate|*.tfstate.*) block "Terraform state" ;;
  *credentials*.json|*service-account*.json|*serviceaccount*.json) block "credentials file" ;;
esac

case "$path" in *../*) block "path contains ../" ;; esac

case "$rel" in
  .claude/settings.json|.claude/settings.local.json|.claude/hooks/*) block "agent guardrails" ;;
  .github/CODEOWNERS|CODEOWNERS) block "code ownership" ;;
  .github/workflows/*) block "PlatformNEX builds with Cloud Build triggers; workflow files are not used" ;;
  .gitleaks.toml|.pre-commit-config.yaml) block "security tooling configuration" ;;
esac

# Outside the repository: only the agent's own working areas are writable.
home="${HOME:-/nonexistent}"
case "$path" in
  "$root"/*) ;;
  "$home"/.claude/settings*.json|"$home"/.claude/remote-settings.json|"$home"/.claude.json) block "Claude Code settings" ;;
  "$home"/.claude/plans/*|"$home"/.claude/projects/*) ;;
  /tmp/*|/private/tmp/*|/var/folders/*|/private/var/folders/*) ;;
  /*)
    if [ -n "${TMPDIR:-}" ] && [ "${path#"${TMPDIR%/}"/}" != "$path" ]; then exit 0; fi
    block "file outside the repository"
    ;;
esac

exit 0
