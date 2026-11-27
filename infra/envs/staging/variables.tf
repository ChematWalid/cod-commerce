variable "state_encryption_passphrase" {
  description = "Passphrase of the client-side state encryption (TF_VAR_state_encryption_passphrase; kept in the operator's password manager)."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.state_encryption_passphrase) >= 32
    error_message = "Use a passphrase of at least 32 characters."
  }
}

variable "cloudflare_account_id" {
  description = "Cloudflare account id (not a secret)."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Id of the zone staging owns (one environment per zone: the module owns the zone's rule entry points)."
  type        = string
}

variable "base_domain" {
  description = "Domain the staging hosts hang under (stores at *.<base_domain>)."
  type        = string
}

variable "origin_ipv4" {
  description = "Public IPv4 of the staging VPS (kamal-proxy)."
  type        = string
}

variable "origin_ipv6" {
  description = "Public IPv6 of the staging VPS, or null."
  type        = string
  default     = null
}

variable "rate_limit_requests_per_period" {
  description = "Per-client requests per 10 s on the rate-limited paths."
  type        = number
  default     = 300
}

variable "assets_bucket_name" {
  description = "Public-assets bucket of staging (production uses assets-prod)."
  type        = string
  default     = "assets-staging"
}
