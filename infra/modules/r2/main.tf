# The public-assets bucket and its custom domain (ADR 0012): product images, derivatives, /sf/_next/static and
# catalog feeds. Exports, labels, imports and backups contain buyer data and live in Algeria (ADR 0011), never here.

resource "cloudflare_r2_bucket" "assets" {
  account_id = var.account_id
  name       = var.bucket_name
  location   = var.location
}

resource "cloudflare_r2_custom_domain" "assets" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.assets.name
  domain      = var.custom_domain
  zone_id     = var.zone_id
  enabled     = true
  min_tls     = "1.2"
}
