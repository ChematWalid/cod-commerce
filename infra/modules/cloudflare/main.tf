# DNS, zone security settings and the Turnstile widget of one environment (ADR 0012). The rule phases live in
# rules.tf and the origin certificate in tls.tf.

locals {
  app_host       = "app.${var.base_domain}"
  api_host       = "api.${var.base_domain}"
  challenge_host = "challenge.${var.base_domain}"
  cdn_host       = "cdn.${var.base_domain}"

  # Every host is proxied, so the edge rules and the Cloudflare-only origin firewall apply to all of them.
  proxied_names = {
    stores    = "*.${var.base_domain}"
    app       = local.app_host
    api       = local.api_host
    challenge = local.challenge_host
  }

  origin_addresses = merge(
    { A = var.origin_ipv4 },
    var.origin_ipv6 == null ? {} : { AAAA = var.origin_ipv6 },
  )

  dns_records = merge([
    for key, name in local.proxied_names : {
      for type, address in local.origin_addresses : "${key}-${type}" => { name = name, type = type, content = address }
    }
  ]...)

  # Full (strict) TLS to the Origin CA certificate, HTTPS only, no TLS below 1.2.
  zone_settings = {
    ssl              = "strict"
    always_use_https = "on"
    min_tls_version  = "1.2"
  }
}

resource "cloudflare_dns_record" "origin" {
  for_each = local.dns_records

  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.content
  proxied = true
  ttl     = 1 # automatic; required value for proxied records
  comment = "${var.environment}: origin load balancer (managed by OpenTofu)"
}

resource "cloudflare_zone_setting" "this" {
  for_each = local.zone_settings

  zone_id    = var.zone_id
  setting_id = each.key
  value      = each.value
}

# Bot Fight Mode stays off: on Free it covers the whole zone and no rule can exempt carrier/payment webhooks,
# the public API or in-app webviews (ADR 0012).
resource "cloudflare_bot_management" "this" {
  zone_id    = var.zone_id
  fight_mode = false
}

# The WAF and cache rules match paths as Cloudflare normalises them (percent-decoded unreserved characters, merged
# slashes), and the origin receives that same normalised path, so a rule and the app never disagree on a path.
resource "cloudflare_url_normalization_settings" "this" {
  zone_id = var.zone_id
  type    = "cloudflare"
  scope   = "both"
}

# One widget on one hostname: stores embed the challenge page served from challenge.<base> (ADR 0012), which keeps
# far below the Free plan's 10 hostnames per widget.
resource "cloudflare_turnstile_widget" "challenge" {
  account_id = var.account_id
  name       = "${var.environment}-cod-challenge"
  domains    = [local.challenge_host]
  mode       = "managed"
}
