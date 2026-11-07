# ADR-0012: Edge, TLS and custom domains

**Date**: 2026-11-07
**Status**: Proposed (new; supersedes the Caddy on-demand TLS plan in P8.S9/P10.S3 briefs)
**Deciders**: architect (draft), user

## Context

- Tenants live at `<sub>.ourdomain` and on merchant custom domains. The P8.S9 brief currently plans Caddy on-demand TLS with an `ask` endpoint.
- **Caddy on-demand TLS** must be restricted by `ask`. It is limited to 10 ACME attempts per 10 s per account, and CA rate limits can lock us out for up to a week. HA needs shared certificate storage (community plugins) or every node re-issues certificates. Config reloads abort in-flight issuance [EH §2, https://caddyserver.com/docs/automatic-https#on-demand-tls].
- **Cloudflare for SaaS (Custom Hostnames)**: 100 hostnames included on Free/Pro/Business, then $0.10/hostname/month up to 50,000. Custom origin is available on all plans. Cloudflare issues and renews certificates through DCV (HTTP or TXT) and preserves the `Host` header, so Next can route by host [EH §2, https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/].
- Cloudflare has an Algiers PoP. Plans: Free $0, Pro $20/mo annual ($25 monthly), Business $200 annual ($250 monthly). Free gets the Free Managed Ruleset, 1 rate-limiting rule and Bot Fight Mode [EH §3]. Turnstile free-tier limits are unconfirmed [EH §3, ?].
- `*.ourdomain` is covered by Universal SSL on Free [EH §2, ?, verify].

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
| `cdn.ourdomain` | R2 custom domain | R2 bucket `assets-prod` (public data only; an R2 custom domain exposes the whole bucket, so private data lives in `private-prod`) | images, derivatives, `/sf/_next/static`, catalog feeds |
| `*.ourdomain` | proxied wildcard | LB → storefront role | store subdomains. Reserved: app, api, cdn, www, admin, mail, status, fallback, stores, staging, static, help, docs, blog |
| `stores.ourdomain` | proxied | LB → storefront | **CNAME target given to merchants** |
| `fallback.ourdomain` | proxied | LB | Cloudflare for SaaS fallback origin |

**Custom domains (P8.S9)**:
1. The merchant enters `shop.mystore.com`. The API creates a Cloudflare custom hostname (SSL method `http` or `txt`, minimum TLS 1.2) and stores `Domain{status: pending, cfHostnameId}`.
2. We show the records: `CNAME shop.mystore.com → stores.ourdomain`, plus the TXT ownership/DCV records Cloudflare returns.
3. A `domains` worker job polls the Cloudflare hostname status (1 min for 10 min, then 15 min for 72 h) and also checks our own TXT `_verify.<domain>` (proves which business owns it, so one business cannot hijack another's domain).
4. When both pass: `verified`. The host map is written to Redis and a pub/sub invalidation is sent (ADR 0006).
5. Make primary, enable and disable are host-map changes. Disable deletes the custom hostname after 7 days.

**Apex domains** (`mystore.com`): Cloudflare for SaaS apex proxying is an Enterprise feature [BK, verify]. Decision:
- (a) if the merchant's DNS supports CNAME flattening/ALIAS (Cloudflare DNS, several registrars), CNAME the apex to `stores.ourdomain`;
- (b) otherwise instruct registrar URL forwarding apex → `www.mystore.com` and connect `www`.
- The UI explains both. If more than 20 % of connect attempts fail on apex after launch, add a small Caddy on-demand edge pair (shared storage on Redis, `ask` = verified-domain check) on a reserved static IP for apex A-records only. The ask-endpoint design from the P8.S9 brief is kept for that path.

**TLS to origin**: SSL mode Full (strict). A Cloudflare Origin CA wildcard certificate (`ourdomain`, `*.ourdomain`) is installed on the DO LB. The DO LB firewall accepts only Cloudflare IP ranges. Droplets have no public 80/443 (VPC only). **The Cloudflare-IP allow-list is not an authentication boundary**: any Cloudflare customer can point a zone at our LB IP and send an arbitrary `Host`. Internal routes are therefore protected in the application (`InternalOnlyGuard` + internal HMAC, ADR 0008), never by host or source IP alone.

**Load balancing and routing**: Cloudflare → DO LB (round robin, node-level health check `/api/readyz` every 10 s, served by the storefront default route and including the node-local api `/readyz`) → kamal-proxy on each droplet, routed by host (`app.`/`api.` → api; everything else → storefront default) [ADR 0013]. **No sticky sessions**: all state is in PG/Redis.

**Protection**:
- Cloudflare WAF Free Managed Ruleset (Launch), Pro managed rules at Growth.
- **Bot Fight Mode stays off at Launch.** On Free it applies to the whole zone and cannot be skipped per path or host [BK, verify], so it would challenge carrier and payment webhooks, public-API and MCP clients, and possibly in-app webviews posting orders. Turnstile and the spam engine handle storefront bots. At Growth (Pro), Super Bot Fight Mode is enabled with skip rules for `/webhooks/*`, `/api/v1/*`, `/mcp`, `/oauth/*` and `/api/store/*`.
- Rate-limiting rule #1 (Free has one; Free counts per IP over a 10 s period [BK]): `/api/store/orders*` and `/api/store/abandoned*`, about 30 requests per 10 s per IP. This is abuse-level only, because Algerian mobile operators put many buyers behind shared CGNAT addresses [BK]; buyer-level limits use the device id in the app, and an exceeded limit becomes a spam hold rather than a 429 (system-design §3–4). Pro (Growth) adds rules for quotes, login and webhooks.
- **Turnstile** (managed/invisible widget) on the COD submit only. Server-side `siteverify` at intake. Failure or timeout → do not reject; pass the `TURNSTILE_FAILED`/`TURNSTILE_UNAVAILABLE` reason to the spam engine (hold), because in-app webviews and poor mobile networks fail challenges.

**HTML caching**: a Cache Rule makes storefront hosts "eligible for cache" with the edge TTL taken from the origin's `Cloudflare-CDN-Cache-Control` header (ADR 0006). It ignores the query string on product, landing and home paths (ad click ids would otherwise make every request unique), and bypasses `/api/*`, `/__preview*` and requests with draft/preview cookies. Purge by hostname on publish, coalesced per store [EH §3; purge-by-hostname, query-string cache-key options and purge rate limits on our plan: ?, verify in spike F].

## Consequences

### Positive
- No ACME or certificate-storage operations. Custom domains get the same WAF and Algiers edge as subdomains.
- Cost is linear and small: Growth with 250 custom domains ≈ $15/mo, Scale with 1,250 ≈ $115/mo [EH §2 pricing].

### Negative
- Apex domains need a workaround (flattening or forwarding).
- Vendor concentration on Cloudflare (DNS, CDN, WAF, TLS, R2, Turnstile).

### Risks
- **A Cloudflare outage takes all storefronts down.** Mitigation: documented runbook to switch DNS to grey-cloud (DNS-only) with the LB terminating TLS with a Let's Encrypt wildcard. The wildcard is **pre-issued and renewed monthly** by a scheduled job (DNS-01) and kept in secrets, because issuing it during an outage may be impossible. The runbook only helps when Cloudflare's proxy is down and its DNS still answers; a Cloudflare DNS outage has no mitigation at Launch. Custom domains and `cdn.ourdomain` (R2) stay down in that mode. Accepted risk.
- **Purge-by-host may not be on our plan.** Fallback: 60 s edge TTL bounds staleness anyway.
- **The query-string cache-key option may not be on our plan.** Fallback: Page Rule "ignore query string" or a Worker normalising URLs ($5/month plan). Without one of them the Launch sizing does not hold for ad spikes.
