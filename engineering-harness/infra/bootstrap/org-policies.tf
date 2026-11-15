# Organisation policies applied to the product folder. They hold no matter who
# or what (person, pipeline, AI agent) makes the request.

locals {
  boolean_constraints = [
    "iam.disableServiceAccountKeyCreation",
    "iam.disableServiceAccountKeyUpload",
    "iam.automaticIamGrantsForDefaultServiceAccounts",
    "compute.skipDefaultNetworkCreation",
    "compute.requireOsLogin",
    "sql.restrictPublicIp",
    "storage.uniformBucketLevelAccess",
    "storage.publicAccessPrevention",
  ]

  location_groups = coalesce(var.allowed_location_groups, ["in:${var.region}-locations"])
}

resource "google_org_policy_policy" "boolean" {
  for_each = toset(local.boolean_constraints)

  name   = "${google_folder.product.name}/policies/${each.value}"
  parent = google_folder.product.name

  spec {
    rules {
      enforce = "TRUE"
    }
  }
}

# Data residency: resources can only be created in the approved region.
resource "google_org_policy_policy" "locations" {
  name   = "${google_folder.product.name}/policies/gcp.resourceLocations"
  parent = google_folder.product.name

  spec {
    rules {
      values {
        allowed_values = local.location_groups
      }
    }
  }
}

# Only identities from your own Workspace can be granted access.
# Note: this also blocks public (allUsers) Cloud Run services. Put public
# endpoints behind a load balancer, or add a scoped exception for that project.
resource "google_org_policy_policy" "domains" {
  name   = "${google_folder.product.name}/policies/iam.allowedPolicyMemberDomains"
  parent = google_folder.product.name

  spec {
    rules {
      values {
        allowed_values = [var.workspace_customer_id]
      }
    }
  }
}

resource "google_org_policy_policy" "run_ingress" {
  name   = "${google_folder.product.name}/policies/run.allowedIngress"
  parent = google_folder.product.name

  spec {
    rules {
      values {
        allowed_values = ["internal", "internal-and-cloud-load-balancing"]
      }
    }
  }
}
