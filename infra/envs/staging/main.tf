# Staging edge: Cloudflare DNS, rules, Turnstile and Origin CA certificate, plus the public-assets R2 bucket.
# The Cloudflare API token comes from CLOUDFLARE_API_TOKEN in the environment, never from a variable or a file.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.28.1"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.4.1"
    }
  }
}

provider "cloudflare" {}

module "edge" {
  source = "../../modules/cloudflare"

  environment                    = "staging"
  account_id                     = var.cloudflare_account_id
  zone_id                        = var.cloudflare_zone_id
  base_domain                    = var.base_domain
  origin_ipv4                    = var.origin_ipv4
  origin_ipv6                    = var.origin_ipv6
  rate_limit_requests_per_period = var.rate_limit_requests_per_period
}

module "assets" {
  source = "../../modules/r2"

  account_id    = var.cloudflare_account_id
  zone_id       = var.cloudflare_zone_id
  bucket_name   = var.assets_bucket_name
  custom_domain = module.edge.hosts.cdn
}

output "hosts" {
  description = "Staging hostnames."
  value       = module.edge.hosts
}

output "turnstile_site_key" {
  description = "Public Turnstile site key for TURNSTILE_SITE_KEY."
  value       = module.edge.turnstile_site_key
}

output "assets_base_url" {
  description = "Public base URL of the assets bucket (STOREFRONT_ASSET_PREFIX is <this>/sf)."
  value       = module.assets.public_base_url
}

output "origin_certificate_expires_on" {
  description = "Expiry of the Origin CA certificate."
  value       = module.edge.origin_certificate_expires_on
}
