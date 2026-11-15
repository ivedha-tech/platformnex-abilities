output "folder" {
  value = google_folder.product.name
}

output "project_ids" {
  value = { for k, p in google_project.this : k => p.project_id }
}

# Enter these in PlatformNEX: System > Settings > Cloud Build, and Component > Setup > TestOps.
output "platformnex_cloud_build_settings" {
  value = {
    project             = local.cicd
    region              = var.region
    artifact_registry   = "${var.region}-docker.pkg.dev/${local.cicd}/${google_artifact_registry_repository.containers.repository_id}"
    build_account       = google_service_account.ci_build.email
    test_account        = google_service_account.ci_tests.email
    test_results_bucket = google_storage_bucket.test_results.name
  }
}
