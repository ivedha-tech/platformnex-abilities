# Environments and release

Build, deployment and release run on PlatformNEX. This kit does not deploy
anything; it sets the rules around the platform and prepares what it needs.

## Environments

Environments are created by a platform admin in PlatformNEX (Administration ›
Environments) and each System opts into the ones it uses. Production is a flag
on the environment, not a name.

| Environment | Purpose | Gets a new version when | Data | Who can change it |
|---|---|---|---|---|
| local | `make dev` (Docker Compose), or `pnx dev run` against dit1 | you run it | synthetic only | you |
| dit1, dit2 | development integration | a pull request merges to `main` (automatic build) | synthetic only | PlatformNEX; developers debug through `pnx` sessions |
| qa, uat | test and acceptance | a release session promotes from the previous environment | synthetic or masked | PlatformNEX release sessions |
| prod | production | a release session, approved by a tech lead | real | PlatformNEX release sessions only; break-glass for anything else |

Pull request previews run in dit1 at their own URL with their own copy of the
database (`make preview`), and expire after a day or when the pull request closes.

GCP projects created by this kit's Terraform (`infra/bootstrap`):

| Project | Holds | Managed by |
|---|---|---|
| `<prefix>-<product>-cicd` | image registry, build and test identities, test results | Terraform; values entered in System › Settings › Cloud Build |
| `<prefix>-<product>-dev`, `-stg`, `-prod` | the product's own cloud resources (databases, buckets, topics) for non-production, pre-production and production | IaC pull requests |
| `<prefix>-<product>-audit` | locked audit log bucket | Terraform; security group read-only |

Clusters, namespaces and workload identities belong to PlatformNEX and its IaC
repositories. Map each PlatformNEX environment to one of the three resource
projects when you register the System, and record the mapping in the handbook.

Production data never leaves production. No copies to non-production
environments, laptops, or AI tools. If you need realistic data, write a generator.

## Pipeline

```
PR opened ──> "PlatformNEX review" check: one approval given in PlatformNEX
              "PlatformNEX tests" (TestOps): cloudbuild-tests.yaml
               lint · unit tests · gitleaks · dependency audit · Trivy config scan
               (no credentials to build, push or deploy)
              optional: pnx dev preview ─> pr-<n>--<component>.dit1…

merge to main ──> PlatformNEX build trigger cb-<component>-<env> (Cloud Build)
               build image once ─> push to Artifact Registry (by digest)
               ─> update the image in the <app>-gitops overlay
               ─> Argo CD syncs the non-production environment

release session ──> qa / uat  (any developer: component › Deliver › Release…)
                ──> prod      (a developer requests; a tech lead who is not the
                               author approves in the Inbox; the build runs only
                               from that environment's release tag)
```

Promotion re-tags the image the source environment runs; nothing is rebuilt.
Settings differ per environment in the GitOps overlay, and secrets in Secret
Manager under the System's prefix. Both are edited in a release's Configuration
phase; a failed build reverts them.

## Identities

- **No service account keys.** Org policy blocks key creation.
- Builds run as `ci-build` (can push images and write logs). Test builds run as
  `ci-tests` (can write logs and test results, cannot push images).
- Each component gets one runtime service account per environment with
  Workload Identity and a fixed set of roles (its own secrets, logs, metrics,
  traces). PlatformNEX creates these in non-production; in production they
  arrive as IaC pull requests that a person merges.
- Humans authenticate with Google Workspace SSO + 2-step verification, and get
  permissions through groups, never individually.
- PlatformNEX acts on GitHub as the person who asked, through their own
  connected account. There is no shared token.

## Who can do what in the release path

| Action | Who | Enforced by |
|---|---|---|
| Build an image | Only PlatformNEX triggers | IAM (developers cannot run or create triggers); guard hooks |
| Start a release session | Developers | PlatformNEX role (`releases:write`) |
| Release to production | Developers request; tech leads and admins may deploy | PlatformNEX roles (`releases:request-prod`, `releases:deploy-prod`) |
| Approve a production release | Tech lead or admin | `requires_deploy_approval` on the environment; the proposal sits in the Inbox |
| Approver is not the author | Procedural | The monthly ops review samples release approvals against PR authors |
| Edit secrets | Tech lead or admin | PlatformNEX role (`config:secrets`) |
| Change a cluster directly | Nobody | Argo CD reverts drift; guard hooks block `kubectl`, `argocd` and `helm` changes |

## Rollback

Open a release session for the component and environment and choose **Roll
back**. PlatformNEX opens a GitOps pull request pointing the image back to the
previous release and Argo CD syncs it. It needs the same approval as a release,
and works only for the latest successful release. **Restart** is the third
option in the same dialog. Database migrations must be backward compatible for
one release (expand, migrate, contract) so rollback is always safe.

## Break-glass

For a production emergency that a release session cannot fix: a platform admin
grants a time-bound IAM role (IAM Conditions with an expiry, at most 4 hours) to
a named person, records the reason in an `emergency-change` issue, and the grant
is reviewed in the postmortem. Every such grant appears in the audit log sink.
Any manual cluster change is put back into the GitOps repository the same day,
or Argo CD will undo it.
