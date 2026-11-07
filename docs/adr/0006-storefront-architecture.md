# ADR-0006: Storefront (Next.js 16 multi-tenant by host)

**Date**: 2026-11-07
**Status**: Proposed — evidence pending P0.S2a-3 (spike F)
**Deciders**: architect (draft), user

Citation keys: [EH §n] = `docs/architecture/research/edge-hosting-costs.md` section n; [BK] = background knowledge, verify before relying on it.

## Context

- Storefronts run on `<sub>.ourdomain` and on merchant custom domains, in ar/fr/en (RTL for ar), mostly on mobile in Algeria behind ad clicks with 10× minute-scale spikes (README assumptions).
- Next.js 16: `proxy.ts` replaces `middleware.ts`. Cache Components (`cacheComponents: true`) with `'use cache'`, `cacheTag` and `cacheLife`; Partial Prerendering is the default. **Cache keys include arguments and the build id, and entries do not survive a deploy.** Reading `headers()` makes a route dynamic, so the tenant must arrive as an argument or a rewritten route param [EH §1, https://nextjs.org/docs/app/getting-started/caching].
- Self-hosting: the default cache is per-instance (50 MB memory + disk). Several instances need `cacheHandler` (+ `cacheMaxMemorySize: 0`) for ISR and `cacheHandlers` (+ `refreshTags()`) for `'use cache'`. They also need the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `deploymentId`/`generateBuildId`. `next/image` works with sharp or a custom loader. Behind a proxy, disable buffering for streaming. Dynamic pages emit `Cache-Control: private`, static ones `public` [EH §1, https://nextjs.org/docs/app/guides/self-hosting, https://nextjs.org/docs/app/guides/cdn-caching].
- **Next 16 configuration surface we rely on** (verified for P0.S2a; context7 and the Next 16 docs): `cacheComponents: true`; `cacheHandlers: { default, remote }` (handlers for `'use cache'` and `'use cache: remote'`); `cacheHandler` (ISR / route cache); `cacheMaxMemorySize: 0` (disable the per-instance memory cache); `deploymentId` (skew protection, part of cache keys); `assetPrefix` (static chunks from a CDN). **`proxy.ts` replaced `middleware.ts`** in Next 16.
- **Shared cache handler candidates for Next 16**: the Next.js repo's Redis cache-handler example; `@mrjasonroy/cache-components-cache-handler@16.4.5`; `@fortedigital/nextjs-cache-handler@3.4.0`; `@trieb.work/nextjs-turbo-redis-cache@1.18.2` (uses the older `redis` 4.7 client). **`@neshca/cache-handler` is not Next 16 compatible and is excluded.**
- The reference serves dashboard and storefronts from one Next.js app by host. That is a reference, not a requirement [P0-setup.md P0.S2a read-first].

## Options

1. **Vercel (Platforms starter model)**: least ops. But it has no regional presence near Algeria [EH §2, ?], costs are driven by bandwidth and functions at our spike profile, and custom-domain mapping moves into the Vercel Domains API. Rejected for Launch; it stays a fallback.
2. **Vendure Shop API (GraphQL) called directly from the browser**: exposes `vendure-token` and session semantics publicly, is hard to cache at the edge, and does not match the reference's REST protocol. Rejected.
3. **Self-hosted Next.js 16 standalone on our nodes, host→store in `proxy.ts`, buyer-agnostic cached HTML, our REST `/store/*` behind a same-origin proxy (recommended).**

## Decision

Option 3.

1. **Runtime**: `output: 'standalone'`, a container role `storefront` from the single platform image (ADR 0013), at least 2 instances, no sticky sessions.
2. **Host resolution in `proxy.ts`**:
   - Normalise the host (lowercase, strip port and a trailing dot).
   - Resolve `host → {storeId, businessId, locale, primaryHost, status}` through an in-process LRU (10 k entries, 60 s), then Redis `host:{host}` (no TTL, invalidated by pub/sub on domain or subdomain change), then the internal API `GET /store/resolve?host=`.
   - Unknown or disabled host → rewrite to `/_404`. Non-primary host → 301 to the primary.
   - An **incoming** path that already starts with `/_t/`, `/_internal` or `/_404` → 404 (also blocked at the edge). Otherwise a buyer could request `storeA.host/_t/<storeB>/...`, render store B (even a disabled one) under store A's host and have Cloudflare cache it there.
   - Otherwise **rewrite** to the internal route `/_t/[storeId]/[locale]/...path`, so the tenant becomes a **route param** and enters every `'use cache'` key without touching `headers()`.
   - A/B tests: when the path has an active test, `proxy.ts` (which may read cookies; page renders may not) assigns or reads the sticky `ab_{testId}` cookie and rewrites to `/_t/[storeId]/[locale]/v/[variant]/...path`.
3. **Buyer-agnostic HTML**: page renders never read cookies or headers. Cart, quotes, the COD form state, live beacons and pixels run client-side. Product, collection, home and landing pages are therefore cacheable per (host, path).
4. **Caching, three layers**:
   - **Cloudflare edge**: Cache Rule for storefront hosts, bypass on `/api/*`, `/__preview*` and draft cookies. The edge TTL comes from a **`Cloudflare-CDN-Cache-Control: max-age=60, stale-while-revalidate=600`** header set by `proxy.ts` on the rewrite response, not from `Cache-Control`, which Next.js manages itself for cached routes [EH §1 CDN caching; Cloudflare's handling of `Cloudflare-CDN-Cache-Control` and SWR is BK, verify in spike F]. Pages under an active A/B test send `Cloudflare-CDN-Cache-Control: no-store`. Purge by hostname on publish, coalesced to one purge per store per 30 s [EH §3; purge-by-host on non-Enterprise plans and purge API rate limits are ?, verify].
   - **Cache key without click ids**: every ad click carries a unique `fbclid`/`ttclid`/`gclid`/`utm_*`, which would otherwise miss the edge on every request. Product, landing and home routes never read `searchParams` on the server; click ids are read client-side by the pixel from the browser URL and sent with the intake. Listing and search pages keep only `page`, `sort`, `q`.
   - **Decision that holds whatever spike F (g) shows**: first choice is a Cache Rule custom cache key that ignores the query string on those paths. **If (g) shows that our Cloudflare plan cannot do that, a Cloudflare Transform Rule (URL rewrite removing `fbclid`, `ttclid`, `gclid`, `gbraid`, `wbraid`, `msclkid`, `utm_*`) or, if a Transform Rule does not change the cache key, a small Worker that normalises the URL strips ad click ids before the cache key.** The rewrite only affects the request sent to cache/origin; the browser URL keeps the click ids, so pixel attribution is unaffected. The click-id list lives in `packages/shared` and is reused by the Worker and the storefront.
   - **Next `'use cache'`** with `cacheTag('store:'+storeId, 'theme:'+storeId, 'product:'+id, 'collection:'+id, 'offers:'+storeId)` and `cacheLife('hours')`. Offer start/end boundaries are handled by a scheduler task that revalidates `offers:{storeId}` at each boundary (ADR 0013).
   - **Shared cache handler**: a Redis-backed `cacheHandlers.default/remote` and `cacheHandler` (ISR), `cacheMaxMemorySize: 0`, small in-process LRU tier, gzip, entries over 512 KB not stored remotely, key namespace `next:{deploymentId}:`, TTL ≤ 6 h at Launch (≤ 24 h once the cache has its own Valkey). Remote writes are skipped while `{env}:cache:writes-off` is set (Valkey above 60 % memory), because at Launch the cache shares a noeviction instance with BullMQ (ADR 0013). Candidates (Context): the Next repo Redis example, `@mrjasonroy/cache-components-cache-handler@16.4.5`, `@fortedigital/nextjs-cache-handler@3.4.0`, `@trieb.work/nextjs-turbo-redis-cache@1.18.2`; `@neshca/cache-handler` excluded (not Next 16 compatible) [EH §1]. Spike F tests them in that order and picks the first that passes (a)–(e) and (h), or a thin in-house handler on the same Valkey client the API uses. The chosen version is pinned exactly.
5. **Publish → revalidate**: the builder publish writes a version, then an outbox event, then the `storefront-revalidate` job. That job calls the internal storefront endpoint `POST /_internal/revalidate {tags}` (HMAC). It calls `revalidateTag` once, and the shared tag manifest in Redis propagates to every instance via `refreshTags()`. Then Cloudflare purges by hostname for the store's hosts.
6. **Deploys**:
   - `deploymentId` = `generateBuildId` = git SHA, the same on all instances of a release.
   - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is a constant secret across releases (storefront avoids Server Actions anyway; route handlers only).
   - `assetPrefix: https://cdn.ourdomain/sf`, and CI uploads `.next/static` to R2 before rollout, keeping 14 days of builds. Old HTML served from cache or by draining instances then never 404s on chunks (skew protection for rolling deploys).
   - After a deploy, a warm-up job requests the top-N store home and product URLs, because cache entries do not survive a deploy [EH §1].
7. **API access**:
   - Server components call the internal API over the private network (`http://api:3000/store/*`), with the internal HMAC header `x-internal-sig` and `x-store-id`.
   - Browser calls go **same-origin**, `/<host>/api/store/*` → a Next route handler that proxies to the internal API with the resolved store injected. No CORS and no client-supplied `storeId`. Includes `CF-Connecting-IP` for rate limits.
   - The API's `/store/*` routes are not routed publicly on `api.ourdomain` (ADR 0012).
8. **Images**: no runtime resizing. The `asset-derivatives` worker job pre-generates WebP presets (160/320/640/960/1280 w) with sharp when an asset is uploaded and stores them in R2 next to the original. A custom `next/image` loader maps the requested width to the nearest preset on `cdn.ourdomain`. This keeps sharp CPU off request paths and avoids per-transformation CDN fees.
9. **i18n/RTL**: the store language decides the locale (`ar` → `dir="rtl"`). A path prefix (`/fr`, `/en`, `/ar`) selects one of the store's extra enabled locales and enters the cache key through the route; no `Accept-Language` negotiation. Catalogues live in `packages/shared/i18n` and `apps/storefront/i18n` (ADR 0005).
10. **Builder runtime**: the editor UI is a dashboard extension (ADR 0010) embedding an iframe preview at `<sub>.ourdomain/__preview?token=` (signed, 30 min, draft mode, `Cache-Control: no-store`). The renderer is the same section registry as live pages.
11. **Marketing and unauthenticated account pages** (`ourdomain`, `www`): sign-up wizard, forgot/reset password, email verification, invitation acceptance, served by the same app under `/(platform)/*` routes (ADR 0010).
12. **Health**: `/api/healthz` (liveness; kamal-proxy's per-container check) and `/api/readyz` (the DO LB's **node-level** check: storefront up and the node-local API `/readyz` within 300 ms; Redis is not required, since pages render without the shared cache). A node whose API is broken is taken out of the LB; the other node carries the load.

**Precondition: spike F "shared cache handler" (P0.S2a-3)**. Two `next start` instances behind a local proxy and one Redis. Prove: (a) a `'use cache'` entry created on A is a hit on B; (b) `revalidateTag('store:1')` on A invalidates on B within 1 s; (c) the tenant param separates keys (store 1 vs 2); (d) a rolling restart with a new `deploymentId` does not serve stale RSC payloads and the old chunks resolve from the `assetPrefix` bucket; (e) memory and Redis size for 1,000 synthetic product pages; (f) a cached tenant page is stored by Cloudflare with the TTL from `Cloudflare-CDN-Cache-Control` (staging zone); (g) two requests differing only by `fbclid` hit the same edge entry on the plan we will buy; (h) `/_t/<other store>` on a store host returns 404. (f) and (g) need a Cloudflare staging zone on the user's account; without it they are recorded as pending and re-run in P3.S5. A failure of (g) does not reopen this ADR: it selects the Transform Rule / Worker branch of Decision 4.

## Consequences

### Positive
- Most storefront traffic is served from the Algiers edge or the Redis cache. Origin load is a fraction of edge load (infrastructure.md).
- No per-tenant infrastructure. Custom domains are a lookup.
- One renderer for live, preview and landing pages.

### Negative
- Self-hosting means owning cache-handler correctness and deploy skew handling.
- All caches go cold on every deploy, so deploy off-peak and warm up afterwards.

### Risks
- **Community cache handlers are young** and may lag a Next minor. Mitigation: spike F, exact pin, Next minors only after a staging soak (tech-stack.md), and a thin in-house handler as fallback.
- **HTML caching bugs could leak one buyer's data.** Mitigation: the buyer-agnostic render rule is enforced by a test that fails if any page under `/_t` calls `cookies()`/`headers()`, plus Cache Rule bypass on cookies, plus a check that tenant responses never carry `Set-Cookie`.
- **Click-id cache busting** (see 4): without click-id stripping the edge hit ratio for ad traffic is near zero and the spike lands on the origin. Spike F (g) decides which mechanism (Cache Rule or Transform Rule / Worker); stripping itself is decided. A Worker adds per-request cost on paid plans [BK, verify in P3.S5].

## Evidence

Pending P0.S2a-3 (spike F).
