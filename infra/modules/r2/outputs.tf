output "bucket_name" {
  description = "Name of the public-assets bucket."
  value       = cloudflare_r2_bucket.assets.name
}

output "public_base_url" {
  description = "Base URL the storefront's asset prefix points at."
  value       = "https://${cloudflare_r2_custom_domain.assets.domain}"
}
