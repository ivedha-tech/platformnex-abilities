locals {
  envs = toset(["dev", "stg", "prod"])

  # key => display name
  projects = {
    dev   = "Development"
    stg   = "Staging"
    prod  = "Production"
    cicd  = "CI/CD"
    audit = "Audit logs"
  }

  project_id = { for k, _ in local.projects : k => "${var.prefix}-${var.product}-${k}" }

  common_services = [
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ]

  env_services = [
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com",
  ]

  cicd_services = [
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "containerscanning.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
  ]

  services_by_project = merge(
    { for k, _ in local.projects : k => local.common_services },
    { for e in local.envs : e => concat(local.common_services, local.env_services) },
    { cicd = concat(local.common_services, local.cicd_services) },
  )

  project_services = merge([
    for p, services in local.services_by_project : {
      for s in services : "${p}/${s}" => { project = p, service = s }
    }
  ]...)
}

resource "google_folder" "product" {
  display_name = "${var.prefix}-${var.product}"
  parent       = "organizations/${var.org_id}"
}

resource "google_project" "this" {
  for_each = local.projects

  name                = "${var.product} ${each.value}"
  project_id          = local.project_id[each.key]
  folder_id           = google_folder.product.name
  billing_account     = var.billing_account
  auto_create_network = false
  deletion_policy     = "PREVENT"

  labels = {
    product     = var.product
    environment = each.key
    managed-by  = "terraform"
  }

  # Guardrails exist before anything is created inside them.
  depends_on = [
    google_org_policy_policy.boolean,
    google_org_policy_policy.locations,
    google_logging_folder_settings.product,
  ]
}

resource "google_project_service" "this" {
  for_each = local.project_services

  project            = google_project.this[each.value.project].project_id
  service            = each.value.service
  disable_on_destroy = false
}
