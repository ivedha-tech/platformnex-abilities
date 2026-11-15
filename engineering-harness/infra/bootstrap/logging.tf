# New projects in the folder keep their default log buckets in-region.
resource "google_logging_folder_settings" "product" {
  folder           = google_folder.product.folder_id
  storage_location = var.region
}

resource "google_logging_project_bucket_config" "audit" {
  project        = google_project.this["audit"].project_id
  location       = var.region
  bucket_id      = "audit-logs"
  retention_days = var.audit_log_retention_days
  locked         = var.lock_audit_bucket

  depends_on = [google_project_service.this]
}

# Every audit log entry from every project in the folder lands in one bucket
# that product teams cannot edit.
resource "google_logging_folder_sink" "audit" {
  name             = "audit-to-central-bucket"
  folder           = google_folder.product.name
  include_children = true
  destination      = "logging.googleapis.com/${google_logging_project_bucket_config.audit.id}"
  filter           = "logName:\"cloudaudit.googleapis.com\""
}

resource "google_project_iam_member" "audit_sink_writer" {
  project = google_project.this["audit"].project_id
  role    = "roles/logging.bucketWriter"
  member  = google_logging_folder_sink.audit.writer_identity
}

resource "google_folder_iam_audit_config" "data_access" {
  count = var.enable_data_access_logs ? 1 : 0

  folder  = google_folder.product.name
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }
  audit_log_config {
    log_type = "DATA_READ"
  }
  audit_log_config {
    log_type = "DATA_WRITE"
  }
}
