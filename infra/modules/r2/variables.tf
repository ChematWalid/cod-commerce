variable "account_id" {
  description = "Cloudflare account id (not a secret)."
  type        = string
}

variable "zone_id" {
  description = "Zone that serves the bucket's custom domain."
  type        = string
}

variable "bucket_name" {
  description = "Name of the public-assets bucket. R2 holds public assets only (ADR 0012); private objects stay in Algeria."
  type        = string

  validation {
    condition     = can(regex("^assets-[a-z0-9-]+$", var.bucket_name))
    error_message = "Only public-asset buckets (assets-*) are managed here; backups and private objects never go to R2."
  }
}

variable "custom_domain" {
  description = "Public hostname of the bucket (cdn.<base>). A custom domain exposes the whole bucket, hence public data only."
  type        = string
}

variable "location" {
  description = "R2 location hint."
  type        = string
  default     = "weur"
}
