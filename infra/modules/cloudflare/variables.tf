variable "environment" {
  description = "Environment name used in resource names and descriptions (staging, production)."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.environment))
    error_message = "environment must be a short lower-case slug."
  }
}

variable "account_id" {
  description = "Cloudflare account id (not a secret). The API token comes from CLOUDFLARE_API_TOKEN, never from a variable."
  type        = string
}

variable "zone_id" {
  description = "Id of the Cloudflare zone this module owns. The module owns the zone's rule-phase entry points, so one environment per zone."
  type        = string
}

variable "base_domain" {
  description = "Domain the environment's hosts hang under: stores at *.<base_domain>, plus app., api. and challenge. (e.g. staging.example.dz)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.base_domain))
    error_message = "base_domain must be a lower-case DNS name."
  }
}

variable "origin_ipv4" {
  description = "Public IPv4 address of the origin load balancer (kamal-proxy on the VPS)."
  type        = string

  validation {
    condition     = can(cidrhost("${var.origin_ipv4}/32", 0))
    error_message = "origin_ipv4 must be an IPv4 address."
  }
}

variable "origin_ipv6" {
  description = "Public IPv6 address of the origin, or null when the origin has none."
  type        = string
  default     = null

  validation {
    condition     = var.origin_ipv6 == null || can(cidrhost("${var.origin_ipv6}/128", 0))
    error_message = "origin_ipv6 must be an IPv6 address or null."
  }
}

variable "rate_limit_requests_per_period" {
  description = "Requests one client (IP and Cloudflare data centre) may send to the rate-limited paths per 10 s period. High on purpose: Algerian mobile carriers put thousands of buyers behind one CGNAT address."
  type        = number
  default     = 300

  validation {
    condition     = var.rate_limit_requests_per_period >= 100
    error_message = "A limit under 100 requests per 10 s would block buyers sharing a CGNAT address."
  }
}

variable "tracking_param_paths" {
  description = "Storefront path prefixes whose cache key drops ad tracking parameters (home is always included). Listing and search paths stay out: they keep page, sort and q."
  type        = list(string)
  default     = ["/product/"]

  validation {
    condition     = alltrue([for p in var.tracking_param_paths : startswith(p, "/") && endswith(p, "/")])
    error_message = "Each prefix starts and ends with a slash."
  }
}
