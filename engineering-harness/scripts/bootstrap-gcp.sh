#!/usr/bin/env bash
# Prepares the GCP foundation for one product: seed project, Terraform state
# bucket, tfvars, then `terraform init` and `terraform plan`. It never applies;
# you review the plan and apply it yourself.
#
# This covers the folder, org policies, projects, audit logging, the image
# registry and the build identities PlatformNEX uses. Clusters, environments,
# triggers, GitOps and runtime identities belong to PlatformNEX and its IaC
# repositories, not to this script.
#
#   ./scripts/bootstrap-gcp.sh --dry-run
#   ./scripts/bootstrap-gcp.sh
set -euo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

[ "${1:-}" = "--dry-run" ] && DRY_RUN=1
need gcloud
load_config
: "${GCP_ORG_ID:?}" "${GCP_BILLING_ACCOUNT:?}" "${PREFIX:?}" "${PRODUCT:?}" "${REGION:?}" "${WORKSPACE_CUSTOMER_ID:?}"
: "${GROUP_PLATFORM_ADMINS:?}" "${GROUP_DEVELOPERS:?}" "${GROUP_SECURITY:?}"

seed="$PREFIX-$PRODUCT-seed"
state_bucket="$seed-tfstate"
tf_dir="$HARNESS_ROOT/infra/bootstrap"

info "Seed project $seed"
if [ "$DRY_RUN" != 1 ] && gcloud projects describe "$seed" >/dev/null 2>&1; then
  info "exists"
else
  run gcloud projects create "$seed" --organization="$GCP_ORG_ID" --name="$PRODUCT seed"
  run gcloud billing projects link "$seed" --billing-account="$GCP_BILLING_ACCOUNT"
fi

info "APIs needed to run Terraform"
run gcloud services enable --project="$seed" \
  cloudresourcemanager.googleapis.com cloudbilling.googleapis.com iam.googleapis.com \
  orgpolicy.googleapis.com serviceusage.googleapis.com logging.googleapis.com \
  cloudkms.googleapis.com artifactregistry.googleapis.com storage.googleapis.com

info "State bucket gs://$state_bucket in $REGION"
if [ "$DRY_RUN" != 1 ] && gcloud storage buckets describe "gs://$state_bucket" >/dev/null 2>&1; then
  info "exists"
else
  run gcloud storage buckets create "gs://$state_bucket" --project="$seed" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
  run gcloud storage buckets update "gs://$state_bucket" --versioning
fi

info "Writing $tf_dir/terraform.tfvars"
if [ "$DRY_RUN" != 1 ]; then
  cat > "$tf_dir/terraform.tfvars" <<TFVARS
org_id                  = "$GCP_ORG_ID"
billing_account         = "$GCP_BILLING_ACCOUNT"
seed_project_id         = "$seed"
prefix                  = "$PREFIX"
product                 = "$PRODUCT"
region                  = "$REGION"
workspace_customer_id   = "$WORKSPACE_CUSTOMER_ID"
group_platform_admins   = "$GROUP_PLATFORM_ADMINS"
group_developers        = "$GROUP_DEVELOPERS"
group_security          = "$GROUP_SECURITY"
TFVARS
fi

[ "$DRY_RUN" = 1 ] || need terraform
info "terraform init + plan"
run terraform -chdir="$tf_dir" init -input=false \
  -backend-config="bucket=$state_bucket" -backend-config="prefix=bootstrap/$PRODUCT"
run terraform -chdir="$tf_dir" validate
run terraform -chdir="$tf_dir" plan -input=false -out=tfplan

info "Review the plan above. To apply: terraform -chdir=$tf_dir apply tfplan"
info "After applying: terraform -chdir=$tf_dir output platformnex_cloud_build_settings"
info "and enter those values in PlatformNEX (System > Settings > Cloud Build)."
