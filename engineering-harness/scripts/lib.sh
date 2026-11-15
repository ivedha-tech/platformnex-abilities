#!/usr/bin/env bash
# Shared helpers. Source this file; do not run it.

HARNESS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${DRY_RUN:-0}"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die() { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

# run <cmd...>: executes, or prints when DRY_RUN=1
run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '   [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required. Run scripts/doctor.sh"; }

load_config() {
  local cfg="${HARNESS_CONFIG:-$HARNESS_ROOT/harness.config.env}"
  [ -f "$cfg" ] || die "Missing $cfg. Copy harness.config.env.example and fill it in."
  set -a
  # shellcheck disable=SC1090
  . "$cfg"
  set +a
  : "${GITHUB_ORG:?}" "${DEFAULT_BRANCH:=main}" "${REQUIRED_APPROVALS:=1}"
  CICD_PROJECT="${PREFIX:-}-${PRODUCT:-}-cicd"
  export CICD_PROJECT
}

repo_exists() { [ "$DRY_RUN" != 1 ] && gh api "repos/$GITHUB_ORG/$1" >/dev/null 2>&1; }
repo_is_empty() { ! gh api "repos/$GITHUB_ORG/$1/commits?per_page=1" >/dev/null 2>&1; }

ensure_repo() { # ensure_repo <name> <description>
  if repo_exists "$1"; then
    info "repo $1 exists"
  else
    info "creating repo $1"
    run gh repo create "$GITHUB_ORG/$1" --private --description "$2"
  fi
}

# Replace __PLACEHOLDER__ tokens in every file under a directory.
render_placeholders() { # render_placeholders <dir> <service> <data-class>
  local dir="$1" service="${2:-service}" data_class="${3:-Internal}"
  grep -rIl '__[A-Z_]*__' "$dir" | while IFS= read -r f; do
    sed -i.bak \
      -e "s|__SERVICE__|$service|g" \
      -e "s|__REGION__|${REGION:-REGION}|g" \
      -e "s|__PREFIX__|${PREFIX:-PREFIX}|g" \
      -e "s|__PRODUCT__|${PRODUCT:-PRODUCT}|g" \
      -e "s|__GITHUB_ORG__|$GITHUB_ORG|g" \
      -e "s|__DATA_CLASS__|$data_class|g" \
      -e "s|__DATE__|$(date +%F)|g" "$f"
    rm -f "$f.bak"
  done
}

# Copy the service template plus lifecycle templates into <dest>.
assemble_template() { # assemble_template <dest>
  local dest="$1"
  mkdir -p "$dest"
  cp -R "$HARNESS_ROOT/repo-template/." "$dest/"
  mkdir -p "$dest/docs/templates"
  cp "$HARNESS_ROOT/templates/"*.md "$dest/docs/templates/"
}

# Initial commit and push of a prepared directory to an empty repo.
push_initial() { # push_initial <dir> <repo> <message>
  local dir="$1" repo="$2" msg="$3"
  if [ "$DRY_RUN" = 1 ]; then
    printf '   [dry-run] push %s files to %s/%s\n' "$(find "$dir" -type f | wc -l | tr -d ' ')" "$GITHUB_ORG" "$repo"
    return
  fi
  if ! repo_is_empty "$repo"; then
    warn "repo $repo already has commits; not pushing (open a PR to update it)"
    return
  fi
  (
    cd "$dir" || exit 1
    git init -q -b "$DEFAULT_BRANCH"
    git add -A
    git commit -q -m "$msg"
    git remote add origin "https://github.com/$GITHUB_ORG/$repo.git"
    git push -q -u origin "$DEFAULT_BRANCH"
  )
}

apply_labels() { # apply_labels <repo>
  local name color desc
  while IFS=$'\t' read -r name color desc; do
    [ -n "$name" ] || continue
    run gh label create "$name" --color "$color" --description "$desc" --force -R "$GITHUB_ORG/$1"
  done < "$HARNESS_ROOT/github/labels.tsv"
}

apply_repo_settings() { # apply_repo_settings <repo>
  run gh api -X PATCH "repos/$GITHUB_ORG/$1" \
    -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
    -F delete_branch_on_merge=true -F allow_auto_merge=false -F has_wiki=false --silent
}

apply_team_access() { # apply_team_access <repo>
  local team perm
  for pair in engineers:push tech-leads:maintain security:push platform-admins:admin; do
    team="${pair%%:*}"; perm="${pair##*:}"
    run gh api -X PUT "orgs/$GITHUB_ORG/teams/$team/repos/$GITHUB_ORG/$1" -f permission="$perm" --silent
  done
}

# Create or update the harness rulesets on a repository.
apply_rulesets() { # apply_rulesets <repo>
  local repo="$1" file name body id checks_json
  checks_json="$(jq -nc --arg s "${REQUIRED_CHECKS:-}" '$s | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0)) | map({context: .})')"
  for file in "$HARNESS_ROOT"/github/rulesets/*.json; do
    name="$(jq -r .name "$file")"
    body="$(jq --argjson n "$REQUIRED_APPROVALS" --argjson checks "$checks_json" '
      (.rules[] | select(.type == "pull_request") | .parameters.required_approving_review_count) = $n
      | if (.target == "branch") and ($checks | length > 0) then
          .rules += [{type: "required_status_checks",
                      parameters: {strict_required_status_checks_policy: true, required_status_checks: $checks}}]
        else . end' "$file")"
    if [ "$DRY_RUN" = 1 ]; then
      printf '   [dry-run] apply ruleset %s to %s (%s rules)\n' "$name" "$repo" "$(printf '%s' "$body" | jq '.rules | length')"
      continue
    fi
    id="$(gh api "repos/$GITHUB_ORG/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id" 2>/dev/null || true)"
    if [ -n "$id" ]; then
      printf '%s' "$body" | gh api -X PUT "repos/$GITHUB_ORG/$repo/rulesets/$id" --input - --silent
    else
      printf '%s' "$body" | gh api -X POST "repos/$GITHUB_ORG/$repo/rulesets" --input - --silent
    fi
    info "ruleset $name applied to $repo"
  done
}

apply_repo_baseline() { # apply_repo_baseline <repo>
  info "baseline for $1: settings, team access, labels, rulesets"
  apply_repo_settings "$1"
  apply_team_access "$1"
  apply_labels "$1"
  apply_rulesets "$1"
}
