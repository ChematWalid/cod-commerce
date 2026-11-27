# The zone's rule-phase entry points: WAF block of internal paths, the one Free-plan rate-limit rule, HTML cache
# rules and the Referrer-Policy header (ADR 0012, D3226 f, #296, #137 item 6). Expressions are built from lists so
# the tests can check each path is covered.

locals {
  path         = "http.request.uri.path"
  decoded_path = "lower(url_decode(http.request.uri.path, \"r\"))"

  # Routes only the storefront or the internal network may call; blocked on every host, custom hostnames included.
  # The app guards them too (InternalOnlyGuard + HMAC, ADR 0008); this keeps junk away from the origin.
  blocked_path_roots    = ["/store", "/_internal", "/_t", "/api/internal"]
  blocked_path_prefixes = ["/shop-api"]
  # An encoded underscore ("/%5f…") never names a public page; it is how /_t and /_internal are smuggled in.
  blocked_raw_prefixes = ["/%5f"]

  blocked_path_expression = join(" or ", concat(
    flatten([for root in local.blocked_path_roots : [
      "${local.decoded_path} eq ${jsonencode(root)}",
      "starts_with(${local.decoded_path}, ${jsonencode("${root}/")})",
    ]]),
    [for prefix in local.blocked_path_prefixes : "starts_with(${local.decoded_path}, ${jsonencode(prefix)})"],
    [for prefix in local.blocked_raw_prefixes : "starts_with(lower(${local.path}), ${jsonencode(prefix)})"],
  ))

  # Paths whose misses cost an api call: search and the store api skip the edge cache (D3226 f), and a random
  # product or category slug is always a miss (#296).
  rate_limited_pages    = ["/search"]
  rate_limited_prefixes = ["/search/", "/api/store/", "/product/", "/category/"]
  rate_limit_expression = join(" or ", concat(
    [for page in local.rate_limited_pages : "${local.path} eq ${jsonencode(page)}"],
    [for prefix in local.rate_limited_prefixes : "starts_with(${local.path}, ${jsonencode(prefix)})"],
  ))

  # Hosts that are not storefronts; every other host on the zone (store subdomains, custom hostnames) is one.
  non_storefront_hosts = [local.app_host, local.api_host, local.challenge_host, local.cdn_host]
  storefront_host      = "not http.host in {${join(" ", [for host in local.non_storefront_hosts : jsonencode(host)])}}"

  # Never stored at the edge: the storefront's own api routes, previews, and per-buyer or per-query pages.
  uncached_prefixes = ["/api/", "/__preview"]
  uncached_pages    = ["/search", "/cart", "/checkout", "/success"]
  preview_cookies   = ["__prerender_bypass", "__next_preview_data"]
  uncached_expression = join(" or ", concat(
    [for prefix in local.uncached_prefixes : "starts_with(${local.path}, ${jsonencode(prefix)})"],
    flatten([for page in local.uncached_pages : [
      "${local.path} eq ${jsonencode(page)}",
      "starts_with(${local.path}, ${jsonencode("${page}/")})",
    ]]),
    [for cookie in local.preview_cookies : "http.cookie contains ${jsonencode(cookie)}"],
  ))

  # Ad click ids and campaign tags never change a page; dropping them lets one edge entry serve every ad click.
  # Only these are dropped, so listing and search keep page, sort and q.
  tracking_params = [
    "fbclid", "gclid", "gbraid", "wbraid", "msclkid", "ttclid",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  ]
  tracking_trimmed_expression = join(" or ", concat(
    ["${local.path} eq \"/\""],
    [for prefix in var.tracking_param_paths : "starts_with(${local.path}, ${jsonencode(prefix)})"],
  ))

  cacheable          = "(${local.storefront_host}) and not (${local.uncached_expression})"
  cache_tracking_off = "${local.cacheable} and (${local.tracking_trimmed_expression})"
  cache_default_key  = "${local.cacheable} and not (${local.tracking_trimmed_expression})"

  # The proxy sets Cloudflare-CDN-Cache-Control before it knows the status (D3226 f), so the edge itself refuses to
  # store errors and throttled answers (-1 = no-store). A 404 is kept briefly so one junk slug costs one origin call.
  status_code_ttls = [
    { status_code = null, status_code_range = { from = 500, to = 599 }, value = -1 },
    { status_code = 429, status_code_range = null, value = -1 },
    { status_code = 404, status_code_range = null, value = 30 },
  ]

  referrer_policy = "strict-origin-when-cross-origin"
}

resource "cloudflare_ruleset" "waf_custom" {
  zone_id     = var.zone_id
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  name        = "${var.environment} custom WAF rules"
  description = "Managed by OpenTofu (infra/modules/cloudflare)."

  rules = [{
    ref         = "block_internal_paths"
    description = "Internal routes are never reachable from the internet, on any host"
    expression  = local.blocked_path_expression
    action      = "block"
    enabled     = true
  }]
}

resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = var.zone_id
  kind        = "zone"
  phase       = "http_ratelimit"
  name        = "${var.environment} rate limits"
  description = "Managed by OpenTofu (infra/modules/cloudflare). Free plan: one rule, path field, 10 s period."

  rules = [{
    ref         = "cgnat_safe_uncached_paths"
    description = "Per client, generous for CGNAT: search, store api and slug lookups"
    expression  = local.rate_limit_expression
    action      = "block"
    enabled     = true
    ratelimit = {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = var.rate_limit_requests_per_period
      mitigation_timeout  = 10
    }
  }]
}

resource "cloudflare_ruleset" "cache" {
  zone_id     = var.zone_id
  kind        = "zone"
  phase       = "http_request_cache_settings"
  name        = "${var.environment} cache rules"
  description = "Managed by OpenTofu (infra/modules/cloudflare). The origin's Cloudflare-CDN-Cache-Control decides the TTL."

  # The three expressions are mutually exclusive, so no rule relies on running after another.
  rules = [
    {
      ref         = "storefront_html_tracking_params_ignored"
      description = "Storefront home and product pages: cache, drop ad tracking params from the key"
      expression  = local.cache_tracking_off
      action      = "set_cache_settings"
      enabled     = true
      action_parameters = {
        cache       = true
        edge_ttl    = { mode = "respect_origin", status_code_ttl = local.status_code_ttls }
        browser_ttl = { mode = "respect_origin" }
        cache_key = {
          custom_key = {
            query_string = { exclude = { list = local.tracking_params } }
          }
        }
      }
    },
    {
      ref         = "storefront_html"
      description = "Other storefront pages: cache with the full query string"
      expression  = local.cache_default_key
      action      = "set_cache_settings"
      enabled     = true
      action_parameters = {
        cache       = true
        edge_ttl    = { mode = "respect_origin", status_code_ttl = local.status_code_ttls }
        browser_ttl = { mode = "respect_origin" }
      }
    },
    {
      ref         = "storefront_uncached"
      description = "Storefront api routes, previews, search, cart, checkout and success pages: never cached"
      expression  = "(${local.storefront_host}) and (${local.uncached_expression})"
      action      = "set_cache_settings"
      enabled     = true
      action_parameters = {
        cache = false
      }
    },
  ]
}

resource "cloudflare_ruleset" "response_headers" {
  zone_id     = var.zone_id
  kind        = "zone"
  phase       = "http_response_headers_transform"
  name        = "${var.environment} response headers"
  description = "Managed by OpenTofu (infra/modules/cloudflare)."

  rules = [{
    ref         = "default_referrer_policy"
    description = "Referrer-Policy when the origin set none; an origin no-referrer (invitations) is kept"
    expression  = "not any(lower(http.response.headers.names[*])[*] == \"referrer-policy\")"
    action      = "rewrite"
    enabled     = true
    action_parameters = {
      headers = {
        "Referrer-Policy" = { operation = "set", value = local.referrer_policy }
      }
    }
  }]
}
