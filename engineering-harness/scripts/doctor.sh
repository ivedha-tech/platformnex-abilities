#!/usr/bin/env bash
# Checks that this machine has what the harness needs. Changes nothing.
set -uo pipefail
missing=0

check() { # check <cmd> <required|optional> <why>
  if command -v "$1" >/dev/null 2>&1; then
    printf '  ok       %-12s %s\n' "$1" "$("$1" --version 2>/dev/null | head -1 | cut -c1-60)"
  elif [ "$2" = required ]; then
    printf '  MISSING  %-12s %s\n' "$1" "$3"; missing=1
  else
    printf '  optional %-12s %s\n' "$1" "$3"
  fi
}

echo "Tools"
check git required "version control"
check gh required "GitHub CLI"
check gcloud required "Google Cloud CLI"
check jq required "used by the scripts and by the agent guard hooks"
check make required "task runner"
check python3 required "3.12 or newer"
check docker required "local dev (make dev)"
check node required "20 or newer; pnx runs on it"
check pnx required "PlatformNEX CLI: run, preview and reach databases in non-production (installed by the pnx-fast-dev plugin)"
check kubectl optional "1.31 or newer; pnx uses it for tunnels (pnx dev doctor --fix installs it)"
check pre-commit optional "installed into the venv by 'make setup'"
check terraform optional "platform owners only (OpenTofu also works)"
check gitleaks optional "local secret scan (CI always runs it)"
check trivy optional "local config/image scan (CI always runs it)"
check claude optional "Claude Code CLI"

echo "Accounts"
if gh auth status >/dev/null 2>&1; then echo "  ok       gh is authenticated"; else echo "  TODO     gh auth login"; missing=1; fi
acct="$(gcloud config get-value account 2>/dev/null || true)"
if [ -n "$acct" ]; then echo "  ok       gcloud account set"; else echo "  TODO     gcloud auth login"; missing=1; fi

node_major="$(node -v 2>/dev/null | sed 's/^v//; s/\..*//')"
if [ -n "$node_major" ] && [ "$node_major" -lt 20 ]; then echo "  TODO     Node $node_major is too old for pnx: nvm install 22 && nvm alias default 22"; missing=1; fi
if command -v pnx >/dev/null 2>&1; then
  if pnx help 2>/dev/null | grep -q "pnx dev setup"; then echo "  ok       pnx is current enough (has 'pnx dev setup')"; else echo "  TODO     pnx is out of date: upgrade Node to 20+, then start a new Claude Code session or reinstall @platformnex/pnx"; missing=1; fi
  if [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/pnx/config.json" ]; then echo "  ok       pnx is signed in"; else echo "  TODO     pnx login --catalog-url <portal>/api/catalog"; missing=1; fi
  echo "  note     run 'pnx dev doctor' for gcloud, kubectl and tunnel checks"
fi

echo "Git"
if [ "$(git config --global --get commit.gpgsign 2>/dev/null)" = true ]; then
  echo "  ok       commit signing is on"
else
  echo "  TODO     enable signed commits (docs/04-onboarding.md); the ruleset rejects unsigned commits"; missing=1
fi
[ -n "$(git config --global --get user.email 2>/dev/null)" ] || { echo "  TODO     git config --global user.email <work email>"; missing=1; }

if [ $missing -eq 0 ]; then echo "All set."; else echo "Fix the items above, then re-run."; fi
exit $missing
