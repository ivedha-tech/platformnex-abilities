#!/usr/bin/env bash
# Creates a new service repository from the template, then hands over to
# PlatformNEX, which owns build, environments, release and runtime identities.
#
#   ./scripts/new-service.sh <name> [--data-class Internal|Confidential|Restricted] [--dry-run]
#
# This script: repository, baseline settings, team access, labels, rulesets.
# PlatformNEX (in the portal, after this): onboarding, cloudbuild.yaml, build
# triggers, GitOps overlay, Argo CD application, runtime service accounts.
set -euo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

name="" data_class="Internal"
while [ $# -gt 0 ]; do
  case "$1" in
    --data-class) data_class="${2:?}"; shift ;;
    --github-only) ;; # kept for old callers: this script no longer touches GCP
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) name="$1" ;;
  esac
  shift
done
[[ "$name" =~ ^[a-z][a-z0-9-]{2,29}$ ]] || die "name must be 3-30 chars: lowercase letters, digits, hyphens"

need gh; need jq; need git
load_config
: "${REGION:?}"
portal="${PNX_PORTAL_URL:-<your PlatformNEX portal>}"
dev_env="${PNX_DEV_ENV:-dit1}"

# Restricted / Confidential services get two reviewers.
case "$data_class" in Confidential|Restricted) REQUIRED_APPROVALS=2 ;; esac

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
info "Rendering template for $name ($data_class, $REGION)"
assemble_template "$tmp/$name"
render_placeholders "$tmp/$name" "$name" "$data_class"

ensure_repo "$name" "$name service"
push_initial "$tmp/$name" "$name" "chore: bootstrap $name from service template"
apply_repo_baseline "$name"

cat <<NEXT

Repository $GITHUB_ORG/$name is ready. Next, in PlatformNEX ($portal):

  1. Connect your GitHub account if you have not (Settings > Connections).
  2. Catalog > Onboard repository > $GITHUB_ORG/$name. Choose the System, and say the
     repository has no build files: PlatformNEX opens a pull request adding
     cloudbuild.yaml and creates the build trigger, GitOps overlay, Argo CD
     application and runtime identity for each non-production environment.
     A tech lead approves the proposal; a platform admin merges the Argo CD pull request.
  3. Component > Setup > TestOps: create a test-only trigger on cloudbuild-tests.yaml
     (service account ci-tests, substitution _TEST_RESULTS_BUCKET) and bind it with
     testRoot "tests/" and specDir "tests/specs".
  4. Merge the first pull request; PlatformNEX builds and Argo CD syncs to $dev_env.
     Check it with:  pnx dev run $name --env $dev_env

Production identities and any database, bucket or topic are requested through an
IaC pull request. Nothing is deployed from this script or from a laptop.
NEXT
