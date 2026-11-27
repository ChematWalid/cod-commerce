# No output carries a secret: the Turnstile secret and the origin private key stay in the encrypted state.

output "hosts" {
  description = "Hostnames of the environment."
  value = {
    stores    = "*.${var.base_domain}"
    app       = local.app_host
    api       = local.api_host
    challenge = local.challenge_host
    cdn       = local.cdn_host
  }
}

output "turnstile_site_key" {
  description = "Public Turnstile site key of the challenge widget (the secret is read from state by P3.S5b)."
  value       = cloudflare_turnstile_widget.challenge.sitekey
}

output "origin_certificate_pem" {
  description = "Origin CA certificate for kamal-proxy (public, but kept out of logs)."
  value       = cloudflare_origin_ca_certificate.origin.certificate
  sensitive   = true
}

output "origin_certificate_expires_on" {
  description = "Expiry of the Origin CA certificate."
  value       = cloudflare_origin_ca_certificate.origin.expires_on
}
