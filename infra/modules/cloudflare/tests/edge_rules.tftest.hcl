# Plan-only checks of the edge rules against Review Focus 3 (no credentials: providers are mocked).
# Run: cd infra/modules/cloudflare && ../../../scripts/ops/tool.sh tofu init && ../../../scripts/ops/tool.sh tofu test

mock_provider "cloudflare" {}
mock_provider "tls" {}

variables {
  environment = "test"
  account_id  = "0123456789abcdef0123456789abcdef"
  zone_id     = "fedcba9876543210fedcba9876543210"
  base_domain = "staging.example.dz"
  origin_ipv4 = "192.0.2.10"
}

run "internal_paths_are_blocked_on_every_host" {
  command = plan

  assert {
    condition = alltrue([
      for fragment in ["eq \"/store\"", "\"/store/\"", "\"/shop-api\"", "\"/_internal/\"", "\"/_t/\"", "\"/api/internal/\"", "\"/%5f\""] :
      strcontains(cloudflare_ruleset.waf_custom.rules[0].expression, fragment)
    ])
    error_message = "The WAF rule must cover /store, /shop-api, /_internal, /_t, /api/internal and /%5f."
  }

  assert {
    condition     = strcontains(cloudflare_ruleset.waf_custom.rules[0].expression, "url_decode(http.request.uri.path, \"r\")")
    error_message = "Internal paths must be matched after recursive percent-decoding."
  }

  assert {
    condition     = !strcontains(cloudflare_ruleset.waf_custom.rules[0].expression, "http.host")
    error_message = "The internal-path block must not depend on the host."
  }

  assert {
    condition     = cloudflare_ruleset.waf_custom.rules[0].action == "block"
    error_message = "Internal paths are blocked, not challenged or logged."
  }
}

run "edge_never_stores_errors_or_throttled_answers" {
  command = plan

  assert {
    condition = alltrue([
      for rule in cloudflare_ruleset.cache.rules : !rule.action_parameters.cache || (
        rule.action_parameters.edge_ttl.mode == "respect_origin" &&
        anytrue([for ttl in rule.action_parameters.edge_ttl.status_code_ttl : try(ttl.status_code_range.from == 500 && ttl.status_code_range.to == 599, false) && ttl.value == -1]) &&
        anytrue([for ttl in rule.action_parameters.edge_ttl.status_code_ttl : ttl.status_code == 429 && ttl.value == -1])
      )
    ])
    error_message = "Every caching rule must respect the origin TTL and refuse to store 5xx and 429."
  }
}

run "per_buyer_and_api_paths_are_never_cached" {
  command = plan

  assert {
    condition = alltrue([
      for rule in cloudflare_ruleset.cache.rules : rule.action_parameters.cache || alltrue([
        for path in ["\"/api/\"", "\"/search\"", "\"/cart\"", "\"/checkout\"", "\"/success\"", "__prerender_bypass"] :
        strcontains(rule.expression, path)
      ])
    ])
    error_message = "The bypass rule must cover the api routes, search, cart, checkout, success and previews."
  }

  assert {
    condition = alltrue([
      for rule in cloudflare_ruleset.cache.rules :
      !rule.action_parameters.cache || strcontains(rule.expression, "and not (starts_with(http.request.uri.path, \"/api/\")")
    ])
    error_message = "Every caching rule must exclude the bypassed paths."
  }

  assert {
    condition = alltrue([
      for rule in cloudflare_ruleset.cache.rules :
      !rule.action_parameters.cache || strcontains(rule.expression, "not http.host in {\"app.staging.example.dz\" \"api.staging.example.dz\"")
    ])
    error_message = "Caching rules apply to storefront hosts only, never app. or api."
  }
}

run "only_tracking_params_leave_the_cache_key" {
  command = plan

  assert {
    condition = alltrue([
      for rule in cloudflare_ruleset.cache.rules : try(rule.action_parameters.cache_key.custom_key.query_string.exclude.list, null) == null || (
        contains(rule.action_parameters.cache_key.custom_key.query_string.exclude.list, "fbclid") &&
        contains(rule.action_parameters.cache_key.custom_key.query_string.exclude.list, "utm_source") &&
        length(setintersection(rule.action_parameters.cache_key.custom_key.query_string.exclude.list, ["page", "sort", "q", "id"])) == 0 &&
        endswith(rule.expression, "and (http.request.uri.path eq \"/\" or starts_with(http.request.uri.path, \"/product/\"))")
      )
    ])
    error_message = "Only ad tracking params are dropped, and only on home, product and landing paths."
  }
}

run "rate_limit_is_cgnat_safe_and_covers_uncached_paths" {
  command = plan

  assert {
    condition     = cloudflare_ruleset.rate_limit.rules[0].ratelimit.requests_per_period >= 100 && cloudflare_ruleset.rate_limit.rules[0].ratelimit.period == 10
    error_message = "The rate limit must stay generous for CGNAT (>= 100 per 10 s)."
  }

  assert {
    condition = alltrue([
      for path in ["eq \"/search\"", "\"/api/store/\"", "\"/product/\"", "\"/category/\""] :
      strcontains(cloudflare_ruleset.rate_limit.rules[0].expression, path)
    ])
    error_message = "The rate limit must cover search, the store api and slug lookups (D3226 f, #296)."
  }
}

run "a_cgnat_unsafe_rate_limit_is_refused" {
  command = plan

  variables {
    rate_limit_requests_per_period = 20
  }

  expect_failures = [var.rate_limit_requests_per_period]
}

run "referrer_policy_is_set_only_when_absent" {
  command = plan

  assert {
    condition     = startswith(cloudflare_ruleset.response_headers.rules[0].expression, "not any(") && strcontains(cloudflare_ruleset.response_headers.rules[0].expression, "\"referrer-policy\"")
    error_message = "Referrer-Policy is added only when the origin sent none (keeps no-referrer on invitations)."
  }

  assert {
    condition     = cloudflare_ruleset.response_headers.rules[0].action_parameters.headers["Referrer-Policy"].value == "strict-origin-when-cross-origin"
    error_message = "Default Referrer-Policy is strict-origin-when-cross-origin (#137 item 6)."
  }
}

run "every_host_is_proxied_and_bot_fight_mode_is_off" {
  command = plan

  assert {
    condition     = length(cloudflare_dns_record.origin) == 4 && alltrue([for record in cloudflare_dns_record.origin : record.proxied])
    error_message = "Stores, app, api and challenge records exist and are all proxied."
  }

  assert {
    condition     = cloudflare_bot_management.this.fight_mode == false
    error_message = "Bot Fight Mode stays off (ADR 0012)."
  }

  assert {
    condition     = cloudflare_zone_setting.this["ssl"].value == "strict"
    error_message = "TLS to origin is Full (strict)."
  }

  assert {
    condition     = cloudflare_turnstile_widget.challenge.domains == tolist(["challenge.staging.example.dz"])
    error_message = "The Turnstile widget covers only the challenge host."
  }
}
