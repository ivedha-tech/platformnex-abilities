# What PlatformNEX's build needs from this product's CI/CD project. PlatformNEX
# creates the triggers, the GitOps overlay and the runtime identities itself;
# the values below are entered once in System > Settings > Cloud Build.
locals {
  cicd = google_project.this["cicd"].project_id
}

# ---------- Registry ----------

resource "google_artifact_registry_repository" "containers" {
  project       = local.cicd
  location      = var.region
  repository_id = "containers"
  format        = "DOCKER"
  description   = "Images built by PlatformNEX build triggers. Deployed by digest."

  depends_on = [google_project_service.this]
}

# ---------- Test results read by PlatformNEX TestOps ----------

resource "google_storage_bucket" "test_results" {
  project                     = local.cicd
  name                        = "${local.cicd}-test-results"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.this]
}

# ---------- Build identities (no keys; used only by Cloud Build) ----------

resource "google_service_account" "ci_build" {
  project      = local.cicd
  account_id   = "ci-build"
  display_name = "Cloud Build: build and push images for PlatformNEX triggers"
}

resource "google_service_account" "ci_tests" {
  project      = local.cicd
  account_id   = "ci-tests"
  display_name = "Cloud Build: test-only builds (cannot push images)"
}

resource "google_project_iam_member" "ci_build" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/artifactregistry.writer",
  ])

  project = local.cicd
  role    = each.value
  member  = google_service_account.ci_build.member
}

resource "google_project_iam_member" "ci_tests" {
  project = local.cicd
  role    = "roles/logging.logWriter"
  member  = google_service_account.ci_tests.member
}

resource "google_storage_bucket_iam_member" "ci_tests_writes_results" {
  bucket = google_storage_bucket.test_results.name
  role   = "roles/storage.objectCreator"
  member = google_service_account.ci_tests.member
}
