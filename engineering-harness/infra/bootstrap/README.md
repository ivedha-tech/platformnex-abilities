# GCP foundation (Terraform)

Creates, for one product / residency boundary:

- A folder with org policies: single-region resource locations, no service
  account keys, no default networks, no public buckets or SQL IPs, Workspace-only
  IAM members, restricted Cloud Run ingress
- Five projects: `dev`, `stg`, `prod`, `cicd`, `audit`
- A central, optionally locked audit log bucket fed by a folder sink
- Artifact Registry, a test-results bucket and two keyless build identities
  (`ci-build`, `ci-tests`): what PlatformNEX's Cloud Build triggers use
- Group-based human access (`iam.tf`)

Not here, because PlatformNEX and its IaC repositories own them: clusters,
namespaces, build triggers, GitOps repositories, Argo CD applications, runtime
service accounts, and who may release or approve.

> **Not yet applied anywhere.** `terraform validate` passes, but `plan` has not
> been run against a real organisation.
> Expect to fix a few things on first plan; read the plan before applying.

## Prerequisites

- You are Organisation Admin, Folder Creator, Project Creator, Organisation
  Policy Admin, Logging Admin and Billing Account User (grant these to the
  platform admins group at the organisation, and use that)
- The three Google groups exist
- Terraform 1.6+ and `gcloud` authenticated (`gcloud auth application-default login`)

## Run

```bash
./scripts/bootstrap-gcp.sh           # seed project, state bucket, tfvars, init, plan
cd infra/bootstrap && terraform apply tfplan
```

## Connect GitHub to Cloud Build (once, interactive)

```bash
gcloud builds connections create github github \
  --region=$REGION --project=$PREFIX-$PRODUCT-cicd
# follow the printed link to install the Cloud Build GitHub app on selected repos
```

## Tell PlatformNEX about it (once per environment)

```bash
terraform output platformnex_cloud_build_settings
```

Enter the project, region, connection name, build account and registry in
PlatformNEX under System › Settings › Cloud Build. PlatformNEX then creates each
component's trigger (`cb-<component>-<env>`) when a repository is onboarded.
Its deployment identity also needs `cloudbuild.builds.editor` on this project
and read access to the test-results bucket; grant those by pull request here
once you know that identity.

## Things to know before the first apply

1. **Region support.** Confirm Cloud Build and Artifact Registry are available
   in your region. If one is not, decide deliberately whether CI/CD metadata may
   live in a neighbouring region and widen `allowed_location_groups` for that
   purpose only.
2. **Location policy side effects.** Secret Manager secrets need user-managed
   replication in the region (automatic replication is global and will be
   refused). Builds must use regional triggers. "Global" resources of some
   services are refused; that is the policy working.
3. **Audit bucket lock is irreversible.** Agree the retention period first.
4. **Domain-restricted sharing** blocks public (allUsers) access. Front public
   endpoints with a load balancer or the platform's ingress.
5. **Org-level settings not in this code** (do them in the Admin console):
   enforce 2-step verification, session length, and restrict who can create
   projects at the organisation level.
6. **Environment names.** The three resource projects are `dev`, `stg` and
   `prod`. PlatformNEX environments (dit1, dit2, qa, uat, prod) map onto them;
   see `docs/02-environments-and-release.md`.

## Multiple products or regions

One state per product: run the bootstrap with a different `PRODUCT` and
`REGION`. Each gets its own folder, so a Canadian product and a UK product
cannot share projects or leak across regions.
