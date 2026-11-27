# Origin CA certificate for Full (strict) TLS between Cloudflare and kamal-proxy (ADR 0012). The private key is
# generated here and lives only in the encrypted state; no output exposes it. P3.S5b copies it into the Kamal
# secret store once (infra/README.md).

locals {
  origin_hostnames = [var.base_domain, "*.${var.base_domain}"]
  # 15 years, the longest Origin CA validity: renewal is a planned replace, not an outage risk.
  origin_cert_validity_days = 5475
}

resource "tls_private_key" "origin" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_cert_request" "origin" {
  private_key_pem = tls_private_key.origin.private_key_pem
  dns_names       = local.origin_hostnames

  subject {
    common_name = var.base_domain
  }
}

resource "cloudflare_origin_ca_certificate" "origin" {
  csr                = tls_cert_request.origin.cert_request_pem
  hostnames          = local.origin_hostnames
  request_type       = "origin-ecc"
  requested_validity = local.origin_cert_validity_days
}
