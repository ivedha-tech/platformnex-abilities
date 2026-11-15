variable "org_id" {
  description = "Numeric GCP organisation id."
  type        = string
}

variable "billing_account" {
  description = "Billing account id (AAAAAA-BBBBBB-CCCCCC)."
  type        = string
}

variable "seed_project_id" {
  description = "Project that holds Terraform state and is used for API quota. Created by scripts/bootstrap-gcp.sh."
  type        = string
}

variable "prefix" {
  description = "Short lowercase organisation prefix used in project ids."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,9}$", var.prefix))
    error_message = "prefix must be 2-10 lowercase letters or digits, starting with a letter."
  }
}

variable "product" {
  description = "Product / residency boundary this harness instance serves."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,11}$", var.product))
    error_message = "product must be 2-12 lowercase letters or digits, starting with a letter."
  }
}

variable "region" {
  description = "The single approved region for this product, for example northamerica-northeast2 or europe-west2."
  type        = string
}

variable "allowed_location_groups" {
  description = "Override for the resource location org policy. Defaults to the single region's value group."
  type        = list(string)
  default     = null
}

variable "workspace_customer_id" {
  description = "Google Workspace / Cloud Identity customer id (C0xxxxxxx). Only identities from this customer may be granted IAM roles."
  type        = string
}

variable "group_platform_admins" {
  description = "Google group email for platform admins."
  type        = string
}

variable "group_developers" {
  description = "Google group email for developers."
  type        = string
}

variable "group_security" {
  description = "Google group email for the security team."
  type        = string
}

variable "audit_log_retention_days" {
  description = "Retention for the central audit log bucket."
  type        = number
  default     = 400
}

variable "lock_audit_bucket" {
  description = "Lock the audit log bucket so retention cannot be shortened or the bucket deleted. Irreversible: leave false until you are sure of the retention period."
  type        = bool
  default     = false
}

variable "enable_data_access_logs" {
  description = "Turn on Data Access audit logs for all services in the product folder. Recommended for compliance; increases log volume and cost."
  type        = bool
  default     = true
}
