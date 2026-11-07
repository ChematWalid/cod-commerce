# ADR-0012: Edge, TLS and custom domains

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-3 review; pending items stay listed as follow-ups
**Deciders**: architect (draft), user

## Context

- Tenants live at `<sub>.ourdomain` and on merchant custom domains. The P8.S9 brief currently plans Caddy on-demand TLS with an `ask` endpoint.
- **Caddy on-demand TLS** must be restricted by `ask`. It is limited to 10 ACME attempts per 10 s per account, and CA rate limits can lock us out for up to a week. HA needs shared certificate storage (community plugins) or every node re-issues certificates. Config reloads abort in-flight issuance [EH §2, https://caddyserver.com/docs/automatic-https#on-demand-tls].
- **Cloudflare for SaaS (Custom Hostnames)**: 100 hostnames included on Free/Pro/Business, then $0.10/hostname/month up to 50,000. Custom origin is available on all plans. Cloudflare issues and renews certificates through DCV (HTTP or TXT) and preserves the `Host` header, so Next can route by host [EH §2, https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/].
- Cloudflare lists PoPs in **Algiers and Annaba** (which Algerian ISPs route there is not published). Plans: Free $0, Pro $20/mo annual ($25 monthly), Business $200 annual ($250 monthly). Free gets the Free Managed Ruleset, 1 rate-limiting rule and Bot Fight Mode [EH §3]. **Turnstile Free: unlimited challenges, up to 20 widgets, 10 hostnames per widget** (verified).
- `*.ourdomain` is covered by Universal SSL on Free (root + first-level subdomains, ECDSA; deeper levels get no valid certificate) (verified).
- **Wildcard custom hostnames** (Cloudflare for SaaS) are Enterprise-only (verified); each merchant hostname is added individually.
- **Data location (ADR 0011, user decision 2026-11-07):** production is hosted in Algeria because of Law 18-07 Art. 44. Cloudflare terminates TLS and caches **public** storefront pages at its edge; whether that edge processing counts as a transfer under Art. 44 is part of ADR 0011's open legal question. Personal data (orders, buyers, exports, labels) is never stored at Cloudflare.

## Options

1. **Caddy on-demand TLS on our nodes (+ optional Cloudflare in front)**: no per-hostname fee and apex A-records work. But we would own ACME rate limits, shared cert storage and HA, and custom-domain traffic would bypass Cloudflare's WAF and Algiers edge unless double-proxied. Rejected as primary; kept as the apex fallback (below).
2. **Cloudflare for SaaS for custom domains + Cloudflare proxy for everything (recommended).**
3. **Vercel Domains API**: ties us to Vercel hosting (ADR 0011 rejects it).

## Decision

Option 2.

**DNS and zones** (one Cloudflare account, zone `ourdomain`):
| Host | Record | Routed to | Notes |
|---|---|---|---|
| `ourdomain`, `www` | proxied | LB → storefront role | marketing, sign-up, account flows |
| `app.ourdomain` | proxied | LB → api role | dashboard (DashboardPlugin) + `/admin-api` |
| `api.ourdomain` | proxied | LB → api role | `/api/v1` (public API), `/webhooks/*`, `/mcp`, `/oauth/*`. **Blocked on every host** (one WAF custom rule): `/store/*`, `/shop-api*`, `/_internal/*`, `/_t/*` |
| `cdn.ourdomain` | R2 custom domain | R2 bucket `assets-prod` (**public data only**: product images, derivatives, `/sf/_next/static`, catalog feeds; an R2 custom domain exposes the whole bucket) | images, derivatives, static, feeds |
| `*.ourdomain` | proxied wildcard | LB → storefront role | store subdomains. Reserved: app, api, cdn, www, admin, mail, status, fallback, stores, staging, static, help, docs, blog |
| `stores.ourdomain` | proxied | LB → storefront | **CNAME target given to merchants** |
| `fallback.ourdomain` | proxied | LB | Cloudflare for SaaS fallback origin |

**Custom domains (P8.S9)**:
1. The merchant enters `shop.mystore.com`. The API creates a Cloudflare custom hostname (SSL method `http` or `txt`, minimum TLS 1.2) and stores `Domain{status: pending, cfHostnameId}`.
2. We show the records: `CNAME shop.mystore.com → stores.ourdomain`, plus the TXT ownership/DCV records Cloudflare returns.
3. A `domains` worker job polls the Cloudflare hostname status (1 min for 10 min, then 15 min for 72 h) and also checks our own TXT `_verify.<domain>` (proves which business owns it, so one business cannot hijack another's domain).
4. When both pass: `verified`. The host map is written to Redis and a pub/sub invalidation is sent (ADR 0006).
5. Make primary, enable and disable are host-map changes. Disable deletes the custom hostname after 7 days.

**Apex domains** (`mystore.com`): Cloudflare for SaaS apex proxying is an Enterprise paid add-on, not available on Free/Pro/Business (verified). Decision:
- (a) if the merchant's DNS supports CNAME flattening/ALIAS (Cloudflare DNS, several registrars), CNAME the apex to `stores.ourdomain`;
- (b) otherwise instruct registrar URL forwarding apex → `www.mystore.com` and connect `www`.
- The UI explains both. If more than 20 % of connect attempts fail on apex after launch, add a small Caddy on-demand edge pair (shared storage on Redis, `ask` = verified-domain check) on a reserved static IP for apex A-records only. The ask-endpoint design from the P8.S9 brief is kept for that path.

**Private objects** (exports, label PDFs, delivery sheets, import files: they contain buyer names, phones and addresses) live in object storage **in Algeria** with the origin (ADR 0011), never in R2. The `private-prod` R2 bucket of the earlier draft is dropped.

**TLS to origin**: SSL mode Full (strict). A Cloudflare Origin CA wildcard certificate (`ourdomain`, `*.ourdomain`) is installed on the origin load balancer (provider per ADR 0011). The origin firewall accepts only Cloudflare IP ranges. Droplets have no public 80/443 (VPC only). **The Cloudflare-IP allow-list is not an authentication boundary**: any Cloudflare customer can point a zone at our LB IP and send an arbitrary `Host`. Internal routes are therefore protected in the application (`InternalOnlyGuard` + internal HMAC, ADR 0008), never by host or source IP alone.

**Load balancing and routing**: Cloudflare → origin LB (round robin, node-level health check `/api/readyz` every 10 s, served by the storefront default route and including the node-local api `/readyz`) → kamal-proxy on each droplet, routed by host (`app.`/`api.` → api; everything else → storefront default) [ADR 0013]. **No sticky sessions**: all state is in PG/Redis.

**Protection**:
- Cloudflare WAF Free Managed Ruleset (Launch), Pro managed rules at Growth.
- **Bot Fight Mode stays off at Launch.** On Free it applies to the whole zone and cannot be bypassed by WAF custom rules or Page Rules (verified; only a matching IP Access rule pre-empts it), so it would challenge carrier and payment webhooks, public-API and MCP clients, and possibly in-app webviews posting orders. Turnstile and the spam engine handle storefront bots. At Growth (Pro), Super Bot Fight Mode is enabled with skip rules for `/webhooks/*`, `/api/v1/*`, `/mcp`, `/oauth/*` and `/api/store/*`.
- Rate-limiting rule #1 (Free: 1 rule, matching on **Path** and Verified Bot only, counting per IP over 10 s, 10 s mitigation timeout; verified): path `/api/store/orders*` and `/api/store/abandoned*` (no Host condition is possible or needed: the paths are the same on every store host), about 30 requests per 10 s per IP. This is abuse-level only, because Algerian mobile operators are assumed to put many buyers behind shared CGNAT addresses (unverified assumption); buyer-level limits use the device id in the app, and an exceeded limit becomes a spam hold rather than a 429 (system-design §3–4). Pro (Growth) adds rules for quotes, login and webhooks.
- **Turnstile** (managed/invisible widget) on the COD submit only. **Hostname limit:** a Free widget allows 10 hostnames and an account 20 widgets (≈ 200 hostnames), far below thousands of store and custom domains. The widget is therefore loaded from our own domain: the storefront embeds a tiny challenge page/iframe served from `challenge.ourdomain` (one widget, one hostname), which posts the token back to the parent page; `siteverify` checks `hostname = challenge.ourdomain`. P3.S4 verifies this in in-app webviews; if it fails there, Turnstile is skipped for that client and the spam engine decides (it never rejects alone anyway). Server-side `siteverify` at intake. Failure or timeout → do not reject; pass the `TURNSTILE_FAILED`/`TURNSTILE_UNAVAILABLE` reason to the spam engine (hold), because in-app webviews and poor mobile networks fail challenges.

**HTML caching**: a Cache Rule makes storefront hosts "eligible for cache" with Edge TTL set to **"Respect origin"** (a fixed Edge TTL would override the origin's `Cloudflare-CDN-Cache-Control` header; ADR 0006). It **ignores the query string** in the cache key on product, landing and home paths (documented as available on self-serve plans; ad click ids would otherwise make every request unique) and bypasses `/api/*`, `/__preview*` and requests with draft/preview cookies. **Purge** by hostname, prefix or tag is available on every plan; the limit is the rate: **Free 5 purge requests/min (bucket 25)**, Pro 5/s, 100 operations per request, per account. Purges are therefore coalesced per store and batched (up to 100 hostnames/tags per request) at Launch. Spike F items (f)/(g) (TTL from the header, `fbclid` sharing one edge entry) run on a staging zone in **P3.S5** (no staging zone in P0.S2a, user decision 2026-11-07).

## Consequences

### Positive
- No ACME or certificate-storage operations. Custom domains get the same WAF and Algiers edge as subdomains.
- Cost is linear and small: Growth with 250 custom domains ≈ $15/mo, Scale with 1,250 ≈ $115/mo [EH §2 pricing].

### Negative
- Apex domains need a workaround (flattening or forwarding).
- Vendor concentration on Cloudflare (DNS, CDN, WAF, TLS, R2, Turnstile).

### Risks
- **A Cloudflare outage takes all storefronts down.** Mitigation: documented runbook to switch DNS to grey-cloud (DNS-only) with the LB terminating TLS with a Let's Encrypt wildcard. The wildcard is **pre-issued and renewed monthly** by a scheduled job (DNS-01) and kept in secrets, because issuing it during an outage may be impossible. The runbook only helps when Cloudflare's proxy is down and its DNS still answers; a Cloudflare DNS outage has no mitigation at Launch. Custom domains and `cdn.ourdomain` (R2) stay down in that mode. Accepted risk.
- **Purge rate on Free (5/min).** Bursty publishes across many stores can queue purges. Mitigation: coalescing + batching; the 60 s edge TTL bounds staleness; Pro (5/s) at Growth.
- **"Ignore query string" is documented for self-serve plans but not yet tested on our zone** (spike F (g), P3.S5). Fallback: a Worker normalising URLs ($5/month plan). Without one of them the Launch sizing does not hold for ad spikes.
- **Custom hostname count**: 100 included, then $0.10/month each, max 50 000 per zone on Free/Pro/Business (verified).

## Evidence

No spike (spike F (f)/(g) pending until P3.S5). The Cloudflare facts above were verified against official documentation on 2026-11-07:

| Fact | Source |
|---|---|
| Universal SSL on Free covers root + first-level subdomains | developers.cloudflare.com/ssl/edge-certificates/universal-ssl/ (and /limitations/) |
| SaaS custom hostnames: 100 included, $0.10 each, max 50 000; custom origin on all plans; wildcard custom hostnames and apex proxying Enterprise-only | developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/ |
| Bot Fight Mode cannot be bypassed by WAF custom rules or Page Rules | developers.cloudflare.com/bots/get-started/bot-fight-mode/ |
| Rate limiting on Free: 1 rule, Path/Verified Bot fields, per-IP, 10 s period and timeout | developers.cloudflare.com/waf/rate-limiting-rules/ |
| Turnstile Free: unlimited challenges, 20 widgets, 10 hostnames each | developers.cloudflare.com/turnstile/plans/ |
| `Cloudflare-CDN-Cache-Control` honoured; Cache Rule Edge TTL "Respect origin"; "Ignore query string" for pay-as-you-go plans | developers.cloudflare.com/cache/concepts/cdn-cache-control/ ; developers.cloudflare.com/cache/how-to/cache-rules/settings/ |
| Purge by URL/hostname/tag/prefix on all plans; non-URL purge rate Free 5/min (bucket 25), Pro 5/s | developers.cloudflare.com/cache/how-to/purge-cache/ |
| PoPs listed in Algiers and Annaba | cloudflare.com/network/ |

Still unverified: Algerian mobile CGNAT behaviour; which Algerian ISPs reach the Algiers/Annaba PoPs (measured with spike G before P10.S3).
