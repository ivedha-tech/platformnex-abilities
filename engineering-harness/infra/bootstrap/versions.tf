terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Bucket and prefix are passed by scripts/bootstrap-gcp.sh (-backend-config).
  backend "gcs" {}
}

provider "google" {
  region                = var.region
  user_project_override = true
  billing_project       = var.seed_project_id
}
