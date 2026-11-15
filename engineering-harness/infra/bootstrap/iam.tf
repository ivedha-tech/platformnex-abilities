# Human access to this product's projects. Groups only; no individual bindings anywhere.
# Who may release and who approves is decided by roles in PlatformNEX (developer,
# tech lead, admin), not by IAM here. Workload identities are created by PlatformNEX
# in non-production and by IaC pull requests in production.

locals {
  developer_roles = {
    dev = [
      "roles/logging.viewer",
      "roles/monitoring.editor",
      "roles/cloudtrace.user",
      "roles/secretmanager.viewer", # metadata only, not secret values
    ]
    stg = [
      "roles/logging.viewer",
      "roles/monitoring.viewer",
    ]
    prod = [
      "roles/logging.viewer",
      "roles/monitoring.viewer",
    ]
    cicd = [
      "roles/cloudbuild.builds.viewer",
      "roles/logging.viewer",
      "roles/artifactregistry.reader",
    ]
  }

  developer_bindings = merge([
    for p, roles in local.developer_roles : {
      for r in roles : "${p}/${r}" => { project = p, role = r }
    }
  ]...)
}

resource "google_project_iam_member" "developers" {
  for_each = local.developer_bindings

  project = google_project.this[each.value.project].project_id
  role    = each.value.role
  member  = "group:${var.group_developers}"
}

resource "google_folder_iam_member" "security" {
  for_each = toset([
    "roles/iam.securityReviewer",
    "roles/logging.viewer",
    "roles/logging.privateLogViewer",
    "roles/cloudasset.viewer",
  ])

  folder = google_folder.product.name
  role   = each.value
  member = "group:${var.group_security}"
}

# Platform admins administer non-production directly. In production they hold
# read access plus the ability to grant themselves a time-bound role
# (break-glass), which the audit sink records.
resource "google_project_iam_member" "platform_admins_nonprod" {
  for_each = toset(["dev", "stg", "cicd"])

  project = google_project.this[each.key].project_id
  role    = "roles/owner"
  member  = "group:${var.group_platform_admins}"
}

resource "google_project_iam_member" "platform_admins_prod" {
  for_each = toset([
    "roles/viewer",
    "roles/resourcemanager.projectIamAdmin",
  ])

  project = google_project.this["prod"].project_id
  role    = each.value
  member  = "group:${var.group_platform_admins}"
}
