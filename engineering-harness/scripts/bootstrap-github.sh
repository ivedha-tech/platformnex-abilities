#!/usr/bin/env bash
# Sets up the GitHub organisation: teams, the four base repos, labels,
# repo settings and rulesets. Safe to re-run.
#
#   ./scripts/bootstrap-github.sh --dry-run        show what would happen
#   ./scripts/bootstrap-github.sh                  do it
#   ./scripts/bootstrap-github.sh --repo NAME      re-apply the baseline to one repo
#   REQUIRED_CHECKS="PlatformNEX review,PlatformNEX tests" ./scripts/bootstrap-github.sh --repo NAME
set -euo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

only_repo=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --repo) only_repo="${2:?--repo needs a name}"; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done

need gh; need jq; need git
load_config
[ "$DRY_RUN" = 1 ] || gh api "orgs/$GITHUB_ORG" >/dev/null 2>&1 || die "Cannot access org $GITHUB_ORG. Run: gh auth login (as an org owner)"

if [ -n "$only_repo" ]; then
  apply_repo_baseline "$only_repo"
  exit 0
fi

info "Teams"
while IFS=$'\t' read -r slug desc; do
  [ -n "$slug" ] || continue
  if [ "$DRY_RUN" != 1 ] && gh api "orgs/$GITHUB_ORG/teams/$slug" >/dev/null 2>&1; then
    info "team $slug exists"
  else
    run gh api -X POST "orgs/$GITHUB_ORG/teams" -f name="$slug" -f description="$desc" -f privacy=closed --silent
  fi
done < "$HARNESS_ROOT/github/teams.tsv"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

info "Organisation defaults (.github)"
ensure_repo ".github" "Organisation-wide issue forms, PR template and community files"
mkdir -p "$tmp/dotgithub"
cp -R "$HARNESS_ROOT/github/org-dotgithub/." "$tmp/dotgithub/"
push_initial "$tmp/dotgithub" ".github" "chore: organisation defaults"

info "Handbook ($HANDBOOK_REPO)"
ensure_repo "$HANDBOOK_REPO" "Engineering handbook: operating model, policies, compliance"
mkdir -p "$tmp/handbook"
for d in docs policies compliance templates; do cp -R "$HARNESS_ROOT/$d" "$tmp/handbook/"; done
cp -R "$HARNESS_ROOT/github/handbook-extras/." "$tmp/handbook/"
render_placeholders "$tmp/handbook"
push_initial "$tmp/handbook" "$HANDBOOK_REPO" "docs: engineering handbook from harness"

info "Platform infrastructure ($INFRA_REPO)"
ensure_repo "$INFRA_REPO" "GCP foundation (Terraform) and harness scripts"
mkdir -p "$tmp/infra"
cp -R "$HARNESS_ROOT/infra" "$HARNESS_ROOT/scripts" "$HARNESS_ROOT/github" "$tmp/infra/"
cp "$HARNESS_ROOT/README.md" "$HARNESS_ROOT/harness.config.env.example" "$HARNESS_ROOT/.gitignore" "$tmp/infra/"
push_initial "$tmp/infra" "$INFRA_REPO" "chore: platform infrastructure from harness"

info "Service template ($TEMPLATE_REPO)"
ensure_repo "$TEMPLATE_REPO" "Template for new services"
assemble_template "$tmp/template"
sed -i.bak "s|__GITHUB_ORG__|$GITHUB_ORG|g" "$tmp/template/.github/CODEOWNERS" && rm -f "$tmp/template/.github/CODEOWNERS.bak"
push_initial "$tmp/template" "$TEMPLATE_REPO" "chore: service template from harness"
run gh api -X PATCH "repos/$GITHUB_ORG/$TEMPLATE_REPO" -F is_template=true --silent

for r in ".github" "$HANDBOOK_REPO" "$INFRA_REPO" "$TEMPLATE_REPO"; do
  apply_repo_baseline "$r"
done

info "Done. Next: github/org-settings-checklist.md (UI-only settings), then scripts/bootstrap-gcp.sh"
