# Edge, storefront and hosting: research notes (as of 2026-11-07)

Legend: [V] verified on an official page fetched during this research; [3P] third-party/aggregator, treat as indicative; [?] unverified/gap. Prices exclude VAT. Re-verify before committing budgets.

## 1. Next.js App Router multi-tenancy, caching, self-hosting
- Official multi-tenant guide is only a pointer to the Platforms Starter Kit [V] https://nextjs.org/docs/app/guides/multi-tenant (page last updated 2025-04).
- Platforms starter (vercel/platforms): Next.js 16, React 19, `proxy.ts` (Next 16 rename of `middleware.ts`) detects subdomain, tenant data in Upstash Redis, wildcard DNS for subdomains; custom-domain mapping is delegated to Vercel [V] https://github.com/vercel/platforms
- Current model: `cacheComponents: true` + `partialPrefetching: true` (default for new apps). Directives `'use cache'`, `'use cache: remote'`, `'use cache: private'`; `cacheLife`, `cacheTag`; Partial Prerendering is the default; ISR works with Cache Components [V] https://nextjs.org/docs/app/getting-started/caching (updated 2026-10-06). Old fetch-cache model is documented separately ("previous model").
- Cache keys include arguments and build id; entries do not survive a deploy, even remote ones [V] same page. Host/tenant must therefore be passed as an argument (or via rewrite to a `/[tenant]/...` param) so it enters the cache key. Reading `headers()` host directly makes the route runtime-dynamic.
- Self-hosting (`next start`/Docker) [V] https://nextjs.org/docs/app/guides/self-hosting (updated 2026-10-15):
  - Default cache is per-instance memory (50 MB) + local disk. Multiple instances need `cacheHandler` (+ `cacheMaxMemorySize: 0`) for ISR/fetch and `cacheHandlers` (+ `refreshTags()`) for `'use cache'`; Redis example in the Next repo; community handlers `@trieb.work/nextjs-turbo-redis-cache`, `@mrjasonroy/cache-components-cache-handler`.
  - Must share across instances: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `generateBuildId`/`deploymentId`.
  - `next/image` optimization works with zero config on `next start` (sharp; memory caveat on glibc) or swap in a custom loader.
  - Recommends reverse proxy (nginx/Caddy); disable proxy buffering for streaming (`X-Accel-Buffering: no`).
  - CDN in front: dynamic pages emit `Cache-Control: private`; fully static emit `public`. See https://nextjs.org/docs/app/guides/cdn-caching.

## 2. Custom domains and TLS
- **Caddy on-demand TLS** [V] https://caddyserver.com/docs/automatic-https#on-demand-tls: must restrict with an `ask` HTTP endpoint (our API answers 200 if the host is a verified tenant domain); Caddy's internal limit is 10 ACME attempts / 10 s per account; CA limits can lock you out up to a week (test on LE staging); instances sharing storage coordinate as a cluster; config reloads abort in-flight issuance.
- HA: shared storage is required or each node re-issues the same cert; Redis/Consul/S3/Postgres storage are community plugins, not core [3P] https://stackharbor.com/en/knowledge-base/caddy-on-demand-tls/ . Scale reference: https://caddy.community/t/scaling-caddy-to-hundreds-of-thousands-of-domains/16508
- Let's Encrypt limits quoted as 300 new orders/account/3 h, 50 certs/registered domain/week [3P, verify at https://letsencrypt.org/docs/rate-limits/]. Per-tenant subdomains under our wildcard avoid the per-domain limit; each merchant custom domain is its own registered domain.
- **Cloudflare for SaaS (Custom Hostnames)** [V] https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/ : Free, Pro and Business zones each include 100 custom hostnames, then $0.10/hostname/month up to 50,000; custom origin available on all plans; non-SNI needs Pro+; custom certs, wildcard hostnames, mTLS are Enterprise only. Fallback origin page not fetched [?]; the model is: customer CNAMEs to our target, Cloudflare issues/renews the cert (DCV via HTTP or TXT), traffic proxies to our fallback origin, `Host` header preserved so Next can route by host.
- **Vercel Domains API** [3P/V-docs search] https://vercel.com/docs/multi-tenant/limits : Pro soft limit 100,000 domains/project, Hobby 50, Enterprise 1M; no per-domain fee; wildcard needs Vercel nameservers; API limits ~100 domain adds/h/team and 50 verifications/h/team. Costs then driven by bandwidth/functions. Vercel from Algeria: no regional presence [?].
- **Wildcard `*.ourdomain`**: DNS-01 via Caddy DNS plugin or acme.sh/certbot; if DNS is on Cloudflare, Universal SSL does not cover second-level wildcards on custom setups but `*.ourdomain` is covered at Free; origin cert from Cloudflare Origin CA or Caddy DNS-01 [?, verify].

## 3. Cloudflare in front, Algeria
- Algiers (DZ) is listed among Cloudflare data center cities (348 cities) [V] https://www.cloudflare.com/network/ . No latency figures published; IP geolocation also places Cloudflare IPs in Algiers [3P] https://www.ip2location.com/104.29.19.0 . Local peering quality with Algerie Telecom/Djezzy/Mobilis is [?]: test with real mobile RUM.
- Plans [V] https://www.cloudflare.com/plans/network-cdn.md : Free $0; Pro $20/mo annual ($25 monthly); Business $200/mo annual ($250 monthly). WAF managed rules: Free Managed Ruleset on Free, managed rules on Pro+. Custom rules 70 / 225 / 450.
- Rate limiting: 1 rule on Free, more on Pro/Business [3P/CF docs table] https://developers.cloudflare.com/waf/ ; Bot Fight Mode on Free, Super Bot Fight Mode Pro+ [docs] https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/ . Turnstile free-tier limits unconfirmed [?].
- HTML caching with per-host keys: Cloudflare cache key includes the Host by default; HTML requires a Cache Rule "Eligible for cache" with edge TTL and bypass on cookies/auth; purge by host/tag (tag purge is Enterprise, purge by host/prefix on lower plans) [?, verify].

## 4. EU hosting options (monthly, ex-VAT)
| Provider / region | 2vCPU/4GB | 4vCPU/8GB | 8vCPU/16GB | LB | Source |
|---|---|---|---|---|---|
| Hetzner Cloud (FSN/NBG/HEL; 20 TB traffic incl.; no Paris) | CPX22 EUR19.99 | CPX32 EUR35.99 | CPX42 EUR69.99 | LB11 about EUR5-9 [3P, rise Apr 2026] | [V] https://www.hetzner.com/cloud/regular-performance |
| DigitalOcean (FRA/AMS) basic | $24 | $48 | $96 | from $12 | [V] https://www.digitalocean.com/pricing/droplets |
| Scaleway Paris | [?] not retrieved | | | LB-S about $18.5 [3P] | https://www.scaleway.com/en/pricing/ (403 on fetch) |
| OVHcloud (GRA/SBG/Paris-region) | [?] | | | [?] | https://www.ovhcloud.com/en/public-cloud/prices/ |
| AWS eu-west-3 | [?] | | | [?] | not retrieved |

Managed data services:
- DigitalOcean: Postgres from $15.15/mo (1 vCPU/1 GB), Valkey from $15/mo; standby nodes selectable (0/1/2), prices not shown [V] https://www.digitalocean.com/pricing/managed-databases ; PITR/read replicas not confirmed on that page [?].
- Scaleway Managed PG: DB-DEV-S main EUR0.0156/h (+ HA node EUR0.0136/h, about EUR21/mo HA); DB-GP-XS main EUR0.1906/h (+ HA EUR0.0911/h, about EUR206/mo HA); backups EUR0.03/GB/mo; offers read replicas; regions Paris/Amsterdam/Warsaw [3P] https://www.scaleway.com/en/pricing/managed-databases-pricing/
- OVH Managed PG: Essential DB1-4 (2 vCPU/4 GB) about $51/mo [3P] https://getdeploying.com/ovh-vs-scaleway ; Business plans have HA/replicas [?].
- Hetzner: no managed Postgres/Redis (self-host on VMs; use pgBackRest/WAL-G to R2/Object Storage for PITR).
- Object storage: Hetzner about EUR4.99/mo incl. 1 TB storage + 1 TB egress, egress about EUR1/TB [3P] https://hetzner.com/storage/object-storage ; Scaleway Standard Multi-AZ EUR0.0146/GB/mo, egress 75 GB free then EUR0.01/GB [3P] https://www.scaleway.com/en/pricing/storage ; DO Spaces from $5 [V].
- Render/Railway/Fly.io/Northflank: not researched [?] (usually EU regions Frankfurt/Amsterdam/Paris only on some).
- Managed PG with PITR + read replicas: confirmed for Scaleway (replicas) and AWS RDS; for DO/OVH verify in docs [?].

## 5. Latency and Marseille
- No public Algiers-to-Paris/Marseille/Frankfurt RTT figure found [?]. Only baseline: Paris-Marseille about 8.9 ms [3P] https://hatsnet.io/docs/network/latency/pairs/par-mrs-rtt.md . My estimate (unsourced): Algiers-Marseille about 25-45 ms, Paris 45-70 ms, Frankfurt 60-90 ms on fixed lines; mobile adds access latency. Measure with RIPE Atlas probes in DZ or RUM.
- Cables to Marseille/Valencia/Palermo (SMW4 Annaba-Marseille, Alval/Orval, Medusa 2026) [3P] https://algeriatech.news/algeria-medusa-africa1-subsea-cable-bandwidth-enterprise-connectivity-2026/
- Marseille hosting: only colocation (Digital Realty MRS1-6) found; no Scaleway/OVH/Hetzner cloud region in Marseille [3P] https://baxtel.com/campus/digital-realty-marseille-campus . Treat Marseille as colo/CDN-edge only.

## 6. Object storage, CDN, images
- Cloudflare R2: $0.015/GB-mo, Class A $4.50/M, Class B $0.36/M, free 10 GB/1M/10M, egress free via S3/Workers/r2.dev [V] https://developers.cloudflare.com/r2/pricing/ (custom-domain serving via Cloudflare CDN is the normal path).
- Bunny CDN Standard (119 PoPs): EU/NA $0.01/GB, Asia/Oceania $0.03, Middle East & Africa $0.06; Volume tier (10 PoPs) $0.005/GB flat [V] https://bunny.net/docs/cdn/pricing . Algeria PoP: [?] not listed in what was fetched.
- Image resizing: Cloudflare Images / Image Resizing and imgproxy not researched [?]; Next `next/image` can run self-hosted (sharp) behind a CDN.

## 7. Email / SMS / WhatsApp
- Email [3P]: Postmark $15/mo for 10k; Resend Pro $20/mo for 50k; SES $0.10/1k. https://dupple.com/learn/best-transactional-email-services
- SMS to Algeria: Twilio $0.273/segment [V] https://www.twilio.com/en-us/sms/pricing/dz ; Plivo carrier rates $0.21-0.32 [3P] https://www.plivo.com/sms/pricing/dz/ . SMS is very expensive: favour WhatsApp/in-app OTP alternatives, or a local aggregator [?].
- WhatsApp Cloud API: per-message pricing since 2025-07-01 (marketing / utility / authentication / service). "Rest of Africa" about $0.0225-0.027 marketing and $0.004-0.0048 utility/authentication [3P, sources disagree]; Meta said more markets would leave "Rest of" regions from 2026-07-01, so Algeria may now have its own rate [?]. Official: https://developers.facebook.com/docs/whatsapp/pricing

## 8. Algerian payments for SaaS billing
- Chargily Pay: no setup/subscription; Starter 0% for first 300 tx/300,000 DZD, then Comfort 1.5% (15-1,500 DZD), Supreme 3%, Elite 4.5%; refunds 2%; payout holds 72/48/24 h; Edahabia/CIB via SATIM, Visa/Mastercard "coming soon" [V] https://chargily.com/business/pay/pricing ; API docs https://dev.chargily.com/pay-v2/introduction.md
- SlickPay: API + sandbox, fees payable by merchant or customer; commercial register, business bank account and agreement reportedly required [3P] https://dzbuild.com/blog/accept-online-payment-algeria ; fee schedule not found [?].
- Both need an Algerian legal entity/KYC (Chargily requires profile verification; SlickPay per 3P). SATIM/CIB direct integration requires bank-sponsored merchant contract [?].

## 9. Observability
- Grafana Cloud Free: about 10k active series, 50 GB logs, 50 GB traces, 3 users, 14-day retention [3P] https://grafana.com/pricing/ ; Pro from $19/mo + usage.
- Sentry: Developer free (1 user, 5k errors); Team $26/mo annual (50k errors) [3P] https://www.capterra.com/p/165426/Sentry/pricing/
- Better Stack / Uptime Kuma / OTel collector: not researched [?]; Uptime Kuma is self-hostable, OTel Collector is the standard vendor-neutral shipper.

## 10. Search
- Meilisearch Cloud: resource-based from about $23/mo (conflicting $14.88), usage-based from $30 [3P] https://www.meilisearch.com/docs/capabilities/platform/billing/pricing_model
- Typesense Cloud: hourly by RAM/vCPU, about $7/mo entry [3P] https://www.meilisearch.com/blog/typesense-pricing (competitor source) ; use calculator.
- Arabic: Meilisearch's Charabia normalizes Arabic (definite-article segmentation, diacritics, tatweel, alef/yeh/teh-marbuta normalization) [3P] https://github.com/meilisearch/charabia . Typesense uses ICU, lists `ar` locale, Arabic-specific stemming unconfirmed [3P] https://typesense.org/docs/guide/locale.html . Postgres FTS has no built-in Arabic stemmer (extension/custom dictionary needed) and Elasticsearch/OpenSearch have an `arabic` analyzer [?, from background knowledge]. Algeria-specific: also French/Latin-script Darija; test mixed-script queries.

## 11. Analytics store
- ClickHouse Cloud Basic from about $66.52/mo (8 GiB, 2 vCPU, limited hours); about $186 if 24/7; pricing page changed Oct 2026 [3P] https://clickhouse.com/docs/products/cloud/reference/billing/billing-overview.md
- Postgres materialized views vs TimescaleDB: not researched [?]. Start with rollup tables in Postgres.

## Implications for our design
1. Put Cloudflare (Algiers PoP exists) in front of everything; Free/Pro is enough to start; cache static assets/images hard, HTML only via explicit cache rules keyed by host.
2. Custom domains: Cloudflare for SaaS gives 100 hostnames free then $0.10 each (no Caddy HA/rate-limit risk); Caddy on-demand + `ask` is the fallback/self-managed path but needs shared storage plugin.
3. Use `*.ourdomain` subdomains for tenants (one wildcard cert, no LE per-domain limits); resolve tenant by Host in `proxy.ts` and pass tenant as an argument so `'use cache'` keys are per-tenant.
4. Self-host Next.js (Docker, 2+ instances) with a Redis cache handler, shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `deploymentId`; Vercel is viable but is not located near Algeria and adds cost at scale.
5. Hetzner (FSN/NBG/HEL, no Paris) is cheapest (CPX32 4/8 at EUR35.99, 20 TB included) but has no managed DB; Scaleway Paris offers managed PG with HA and replicas and is nearest to Algeria. Decide: Scaleway Paris managed PG + Hetzner/Scaleway compute, or all-in Scaleway.
6. Images on R2 + Cloudflare CDN (zero egress); Bunny's Africa rate ($0.06/GB) is not attractive.
7. SMS to +213 is about $0.27: prefer WhatsApp utility messages and email; make SMS an opt-in paid add-on.
8. SaaS billing via Chargily (0% first 300 tx, then 1.5-4.5%) requires an Algerian entity; plan for DZD pricing and manual/bank-transfer fallback.
9. Search: start with Postgres or Meilisearch (documented Arabic normalization); run an Arabic/French/Darija relevance test before choosing; self-host to avoid the $23+ cloud base.
10. Open items to verify before budgeting: Scaleway/OVH/AWS VM prices, Algiers RTT measurements, Cloudflare HTML cache purge options, Turnstile limits, WhatsApp Algeria rate.
