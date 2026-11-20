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
# The pnx version the pnx-context plugin needs, when it has asked for a newer one than is installed.
WANTED="$DIR/.ensure-wanted"
SIGN_IN="gcloud auth login, then gcloud auth application-default login"

command -v npm >/dev/null 2>&1 || exit 0
mkdir -p "$DIR" 2>/dev/null || exit 0
# Run npm and npx from our own folder: from the session's repo, its .npmrc or node_modules/.bin would be used.
cd "$DIR" || exit 0

# Once a day (PNX_ENSURE_FORCE=1 skips the wait), or at every start while a needed version hasn't arrived yet.
if [ -z "${PNX_ENSURE_FORCE:-}" ] && [ ! -f "$WANTED" ] && [ -f "$STAMP" ] && [ -n "$(find "$STAMP" -mtime -1 2>/dev/null)" ]; then exit 0; fi

# Node first, and no stamp when it fails: the stamp is for a check that ran, so once Node is upgraded the very next
# session installs pnx (stamping first made it wait a day, with the message promising "next session").
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${node_major:-0}" -lt 20 ]; then
  echo "pnx needs Node.js 20 or newer (you have $(node -v 2>/dev/null || echo none)). Install it from nodejs.org; pnx then installs itself next time."
  exit 0
fi
touch "$STAMP"

# npm's folder goes in as an argument: pasted into the script, Windows backslashes (\node_modules) break the path.
installed="$(node -p "require(require('path').join(process.argv[1],'@platformnex','pnx','package.json')).version" "$(npm root -g)" 2>/dev/null || true)"

# A failed try writes why (auth, access, network, install) and drops the stamp, so the next session tries again.
failed() {
  echo "$1" > "$DIR/.ensure-problem"
  rm -f "$STAMP"
}

# Whether version $1 is newer than $2: x.y.z by number, and a release is newer than its own pre-release (0.2.0 is
# newer than 0.2.0-rc.1). A missing or unreadable version counts as 0.0.0.
newer() {
  node -e "const v=s=>{const[c,pre]=s.split('-');const p=c.split('.');return{n:[0,1,2].map(i=>Number(p[i])||0),pre:pre!==undefined}};const[a,b]=process.argv.slice(1).map(v);const d=a.n[0]-b.n[0]||a.n[1]-b.n[1]||a.n[2]-b.n[2];process.exit(d>0||(d===0&&b.pre&&!a.pre)?0:1)" "$1" "$2"
}

(
  {
    echo "== $(date -u +%FT%TZ) installed=${installed:-none}"
    npm config set @platformnex:registry "$REGISTRY" >/dev/null 2>&1
    if ! npx --yes google-artifactregistry-auth >/dev/null 2>&1; then
      echo "registry sign-in failed: run $SIGN_IN"
      failed auth
      exit 0
    fi
    # The version comes from stdout alone. npm's warnings and notices (such as "new npm version available") go to
    # stderr, which is read only to tell why the lookup failed.
    errors="$DIR/.npm-errors"
    if ! view="$(npm view @platformnex/pnx version 2>"$errors")"; then
      # 401: no usable sign-in. 403 even with a fresh token: this Google account can't read the registry (often the
      # wrong account signed in). A network error is neither.
      case "$(cat "$errors" 2>/dev/null)" in
        *E401*) echo "registry refused the sign-in (401)"; failed auth ;;
        *ENOTFOUND* | *ETIMEDOUT* | *ECONNRESET* | *ECONNREFUSED* | *EAI_AGAIN*) echo "couldn't reach the registry"; failed network ;;
        *) echo "can't read @platformnex/pnx (no access with this Google account?)"; failed access ;;
      esac
      rm -f "$errors"
      exit 0
    fi
    rm -f "$errors"
    # Only a plain version (1.2.3) counts; anything else is treated as no answer and tried again next session.
    latest="$(printf '%s\n' "$view" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | tail -n 1)"
    if [ -z "$latest" ]; then
      echo "the registry gave no version; trying again next session"
      rm -f "$STAMP"
      exit 0
    fi
    # For pnx-context: the registry's newest, to tell "not released yet" from "not updated yet".
    echo "$latest" > "$DIR/.ensure-latest"
    # Only ever upgrade: a newer pnx installed by hand is kept, never swapped for the registry's older one.
    have="$installed"
    if newer "$latest" "$have"; then
      if ! npm i -g "@platformnex/pnx@$latest"; then
        echo "installing $latest failed; trying again next session"
        failed install
        exit 0
      fi
      echo "installed $latest"
      have="$latest"
    else
      echo "up to date (${installed:-none}; registry has $latest)"
    fi
    # Once the needed version is here, back to once a day; until then every start checks again (see the top).
    if [ -f "$WANTED" ]; then
      wanted="$(cat "$WANTED")"
      if newer "$wanted" "$have"; then echo "waiting for pnx $wanted (registry has $latest)"; else rm -f "$WANTED"; fi
    fi
    rm -f "$DIR/.ensure-problem"
  } >>"$LOG" 2>&1
) </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true

# Say what the last background run couldn't do (one line, then let the session go on).
case "$(cat "$DIR/.ensure-problem" 2>/dev/null)" in
  auth) echo "pnx couldn't install: sign in to Google ($SIGN_IN), then restart Claude Code." ;;
  access) echo "pnx couldn't install: your Google account has no access. Sign in with your work account ($SIGN_IN) and restart Claude Code. Still failing? Ask a PlatformNEX admin." ;;
  network) echo "pnx couldn't install: no connection (internet or VPN?). It tries again next time." ;;
  install) echo "pnx couldn't install (details in $LOG). It tries again next time." ;;
esac
exit 0
