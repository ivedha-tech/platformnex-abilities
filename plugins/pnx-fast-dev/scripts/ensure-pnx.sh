#!/usr/bin/env bash
# Keeps @platformnex/pnx installed and up to date. Run by Claude Code at session start (pnx-fast-dev Ability).
#
# - At most once a day (a stamp in ~/.config/pnx); otherwise exits at once.
# - Never blocks the session: the install runs in the background and logs to ~/.config/pnx/install.log.
# - Prints one line only when something needs a person (Claude Code shows SessionStart output to Claude).
# - Touches nothing outside npm's global packages, npm's user config (the @platformnex registry line and its
#   short-lived token, written by google-artifactregistry-auth) and ~/.config/pnx.
set -u
REGISTRY="https://us-central1-npm.pkg.dev/ivedha-mgmt-env-nonprod/platformnex-npm/"
DIR="${PNX_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/pnx}"
STAMP="$DIR/.ensure-checked"
LOG="$DIR/install.log"

command -v npm >/dev/null 2>&1 || exit 0
mkdir -p "$DIR" 2>/dev/null || exit 0

# Once a day.
if [ -f "$STAMP" ] && [ -n "$(find "$STAMP" -mtime -1 2>/dev/null)" ]; then exit 0; fi
touch "$STAMP"

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${node_major:-0}" -lt 20 ]; then
  echo "pnx needs Node 20 or later (found $(node -v 2>/dev/null)); upgrade Node, then pnx installs itself next session."
  exit 0
fi

installed="$(node -p "require('$(npm root -g)/@platformnex/pnx/package.json').version" 2>/dev/null || true)"

(
  {
    echo "== $(date -u +%FT%TZ) installed=${installed:-none}"
    npm config set @platformnex:registry "$REGISTRY" >/dev/null 2>&1
    if ! npx --yes google-artifactregistry-auth >/dev/null 2>&1; then
      echo "registry sign-in failed: run gcloud auth application-default login"
      echo "auth" > "$DIR/.ensure-problem"
      exit 0
    fi
    latest="$(npm view @platformnex/pnx version 2>/dev/null || true)"
    if [ -z "$latest" ]; then
      echo "can't read @platformnex/pnx (no access to the registry?)"
      echo "access" > "$DIR/.ensure-problem"
      exit 0
    fi
    if [ "$latest" != "${installed:-}" ]; then
      npm i -g "@platformnex/pnx@$latest" && echo "installed $latest"
    else
      echo "up to date ($latest)"
    fi
    rm -f "$DIR/.ensure-problem"
  } >>"$LOG" 2>&1
) </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true

# Say what the last background run couldn't do (one line, then let the session go on).
case "$(cat "$DIR/.ensure-problem" 2>/dev/null)" in
  auth) echo "pnx couldn't be installed: Google sign-in for the npm registry failed. Run: gcloud auth application-default login" ;;
  access) echo "pnx couldn't be installed: no read access to the PlatformNEX npm registry. Ask a PlatformNEX admin." ;;
esac
exit 0
