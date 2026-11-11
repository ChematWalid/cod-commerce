# P3 — Storefront & COD checkout

**Phase goal:** public store per subdomain with the COD form, live quotes, order intake.

**Exit criteria:** A buyer on `<sub>.localhost` orders a product with wilaya/commune/home-desk; the order appears as pending with the signed quote total; abandoned checkouts captured; staging deploys on merge to `main` (P3.S5).

**Session order and lanes**
- **P3.S1** (geo + delivery pricing, needs only P1.S5) runs in parallel with P2.* and with **P3.S2** (storefront skeleton, needs P2.S1 and P1.S6).
- Then serial: **P3.S3** (needs P3.S1, P3.S2, P2.S4; parallel-safe with P2.S5 and P3.S5) → **P3.S4** (also needs P1.S6).
- **P3.S5** (staging environment, IaC, observability baseline; needs P3.S2 and P1.S6) runs in parallel with P2.*, P3.S3 and P3.S4. It must be merged before P8.S9 and P10.S3.
- Shared files touched only by appending a registration line: `apps/server/src/vendure-config.ts`, `packages/shared/src/index.ts`.

Brief format: [_session-template.md](_session-template.md). Rules: [CONTRIBUTING.md](CONTRIBUTING.md). Architecture reference: [../architecture/README.md](../architecture/README.md). Own branding only: never use the name, logo, theme names or copy of the reference product; clone behaviour only.

---

## P3.S1 — Wilaya/commune data & delivery pricing

| Field | Value |
|---|---|
| **Goal** | Provide the 58 wilayas with all communes (ONS codes), the `/provinces` endpoints, delivery-fee groups ("pricing options") with the seeded default table, a shipping-quote service, and the Delivery → Delivery Pricing admin tab. |
| **Branch** | `feat/p3-s1-geo-delivery-pricing` |
| **GitHub issue** | `P3.S1 Wilaya/commune data & delivery pricing` (label `phase-3`, milestone `P3 Storefront & COD checkout`) |
| **Prerequisites** | P1.S5 merged |
| **Parallel-safe** | Yes, with P2.*, P3.S2 and P1.S6. Owns `plugins/geo/**`, `plugins/delivery-pricing/**`, `packages/shared/src/geo/**`, `packages/shared/src/delivery/**`. |
| **Model / size** | Sonnet · M |
| **External needs** | None. Commune seed built from the public ONS commune list (document source URL, retrieval date and licence in `plugins/geo/DATA-SOURCE.md`); platform default prices are our own placeholder values. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`)
- Delivery pricing options: name, carrier, overweight charge, per-wilaya home and stop-desk prices for 58 wilayas, apply-to-all, per-wilaya delivery toggle, overrides, sync defaults from carrier — `/delivery?tab=pricing` (this session: everything except the carrier sync; sync hooks only, real sync in P5.S4–S7)
- Wilaya and commune reference data — `/provinces`, `/provinces/code/:code`
- Commune data with ONS codes and per-commune home/stop-desk availability
- Default "Tassyir prices" delivery-fee table; carrier price sync keeps your overrides (default table seeded under our own name, e.g. "Platform default prices"; sync part = P5.S4–S7)
- Storefront pricing engine: … shipping-quote (base, overweight, waived, speed) (service part only; HTTP endpoint and cart-quote are P3.S3)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P1.S1, P1.S5
- `docs/research/data-model.md` → "Storefront ordering protocol" items 1–2 (`Province`, `towns`, `codeOns`, `isStopdesk`, `isHomeDelivery`, shipping-quote response)
- `docs/research/dashboard-captures.md` → "Delivery & Shipping" (Delivery Pricing tab, New pricing option form), "Store settings" (Operations → Delivery Fee Group)
- `docs/research/api-surface.md` → "Delivery" (`/delivery-fees`, `/overrides`, `/sync-default`), `/provinces`
- `docs/research/second-pass.md` → "Carriers (connect forms)" (overweight allowance + rate)

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #153 TEN-4 (low): fix(tenancy): check ownership of default carrier and fee group ids

**High-level plan**
1. Shared types/zod: `Province`, `Town`, `DeliveryFeeGroup`, `ShippingQuote` in `packages/shared` → commit `feat(shared): geo and delivery-fee types`
2. `geo` plugin: Province/Town entities (global reference data, not tenant-owned), migration, idempotent seed from the ONS list (58 wilayas with `arabicName`, `names[]` aliases; communes with `codeOns`, `isStopdesk`, `isHomeDelivery`) → commit `feat(geo): wilaya and commune seed`
3. Public REST `/provinces` and `/provinces/code/:code?storeId` (cached; stop-desk flag may be narrowed per store) → commit `feat(geo): provinces endpoints`
4. `delivery-pricing` plugin: `DeliveryFeeGroup` (+ per-wilaya rows, `overrides`), GraphQL CRUD with tenant guard, default table seeded per store and linked as the store's default fee group → commit `feat(delivery-pricing): fee groups and default table`
5. `ShippingQuoteService.quote({storeId, provinceCode, stopdesk, items})` → `{baseFee, overweightFee, totalFee, resolved, speed, offeredSpeeds[], freeShipping, waivedFee}`; overweight from carrier allowance/rate placeholder (nullable carrier → group-level rate) → commit `feat(delivery-pricing): shipping quote service`
6. Dashboard extension: Delivery → Delivery Pricing tab (store filter, search, Add pricing option; columns Pricing Option / Delivery Agent / Created / Actions; form with charge-overweight toggle, Apply to all, Deliver to every wilaya, Stop desk in every delivered wilaya, per-wilaya toggle, 58-row table) → commit `feat(delivery-pricing): pricing tab ui`
7. `CarrierPriceSyncPort` (no-op default) and an override-preserving merge function with tests → commit `feat(delivery-pricing): carrier sync hook`

**Deliverables:** `plugins/geo`, `plugins/delivery-pricing` (+ dashboard extension), migrations, a `seed:geo` workspace script (package manager per ADR 0001), GraphQL CRUD, REST `/provinces*`, `ShippingQuoteService` exported for P2.S4/P3.S3/P4.S3, "delivery pricing" permissions (create/view/delete/edit) registered in the catalog.

**Acceptance criteria**
- [ ] Exactly 58 provinces with Arabic name and aliases; every commune has a unique `codeOns`; a spot-check of 10 communes (incl. Alger, Oran, Tamanrasset) matches the source list.
- [ ] `GET /provinces/code/16` returns `towns[]` with `codeOns`, `isStopdesk`, `isHomeDelivery` in the data-model.md shape.
- [ ] "Apply to all" sets all 58 rows; "Deliver to every wilaya" and "Stop desk in every delivered wilaya" toggle rows; one wilaya can be switched off or have stop-desk disabled.
- [ ] A new store gets the seeded default table as its default fee group; editing a price creates an override that a (mock) sync never overwrites.
- [ ] Quote: home vs stop-desk base fee by wilaya; overweight fee = ceil(weight − allowance) × rate only when "charge overweight to customer" is on; free delivery returns `freeShipping`, `waivedFee` and fee 0; an undelivered wilaya returns `resolved:false`.
- [ ] Pricing screens require the delivery-pricing permissions.

**Verification**
- Unit: quote maths (allowance edge, rounding, waived, stop-desk off), override-preserving merge. Integration: fee-group CRUD, `/provinces*`, seed idempotency (run twice → same counts).
- Browser: Delivery Pricing tab and New pricing option form vs `dashboard-captures.md` "Delivery & Shipping"; attach screenshots.
- Multi-tenant: business A cannot list, read or edit business B's fee groups or overrides; reference data is readable by all.

**Out of scope:** carrier adapters and real price sync (P5.S4–S7), the HTTP `/store/shipping-quote` endpoint (P3.S3), storefront UI.

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P3.S1 "Wilaya/commune data & delivery pricing" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P3-storefront-checkout.md (section P3.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p3-s1-geo-delivery-pricing from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P3.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P3.S2 — Multi-tenant storefront skeleton

| Field | Value |
|---|---|
| **Goal** | A Next.js storefront that resolves the store by host, applies store settings (name, logo, language, RTL), serves public product APIs and renders the basic pages from a pluggable minimal theme JSON. |
| **Branch** | `feat/p3-s2-storefront-skeleton` |
| **GitHub issue** | `P3.S2 Multi-tenant storefront skeleton` (label `phase-3`, milestone `P3 Storefront & COD checkout`) |
| **Prerequisites** | P2.S1 and P1.S6 merged (P1.S6 provides the internal HMAC client that the same-origin `/api/store/*` handlers and `/_internal/revalidate` use) |
| **Parallel-safe** | Yes, with P2.S4, P2.S5, P3.S1. Owns `apps/storefront/**` (except `apps/storefront/src/lib/internal-api.ts`, owned by P1.S6; extend it, do not fork it), `plugins/storefront-api/**`, `packages/shared/src/storefront/**`. |
| **Model / size** | Opus · L |
| **External needs** | None. Dev hosts are `<sub>.localhost` (wildcard resolves natively in browsers). |

**Inventory rows covered**
- Store profile: logo, name, description, language AR/FR/EN, default delivery fee group, default carrier, show address field (data model from P1.S1; this session applies name, logo, description, language and show-address on the storefront)
- Storefront: home, product list, product page with variant pickers and quantity, cart, category, search (this session: home, product list, product page shell with variants/quantity, category, search, cart/checkout shells; behaviour in P3.S3)
- Sold-out behaviour: keep showing or hide; stop/resume orders (storefront side only: hide/show sold-out products per store setting)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P1.S1, P1.S5, P1.S6, P2.S1; tenancy and storefront ADRs in `docs/adr/`
- docs/adr/0006-* (storefront) and docs/architecture/system-design.md §2.1, §3
- `docs/research/data-model.md` → "Product" (options, variants), "Storefront ordering protocol" (host model)
- `docs/research/api-surface.md` → "Catalog & store" and "Added in the second pass → Storefront" (`/store/products`, `/store/product/:slug`, `/store/product/search`)
- `docs/research/second-pass.md` → "Storefront order → delivered" step 1, "Builder page templates" (page list and default section order), "Collections"
- `docs/research/dashboard-captures.md` → "Store settings" (Profile)

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #120 SF-2 (medium): feat(storefront): add the deferred cache safeguards
- #121 SF-4 (medium): fix(storefront): bound cache commands with a socket timeout
- #180 SF-3 (low): fix(storefront): cache unknown hosts negatively
- #181 SF-5 (low): docs(evidence): refresh the stale P0.S2b-5 storefront evidence
- #182 SF-6 (low): ci: run the storefront cross-tenant smoke test on pull requests
- #183 SF-7 (low): fix(storefront): prune ISR tag sets
- #184 SF-8 (low): fix(storefront): stop returning raw error text from /readyz
- #209 CO-8 (low): feat(storefront): check that a /_t/[storeId] page matches the host

**High-level plan**
1. Per-request store context on top of the host resolver that P1.S1 already wired into proxy.ts: proxy.ts rewrites to the internal route /_t/[storeId]/[locale]/… so the tenant is a route param (never read headers()/cookies() in page renders) (`GET /store/resolve?host=`; extend it, do not write a second resolver): store settings loaded once per request, custom-domain lookup stays stubbed for P8.S9; unknown host → 404 → commit `feat(storefront): per-request store context`
2. `storefront-api` plugin: public REST `/store/products` (paging, collection filter), `/store/product/:slug`, `/store/product/search`, `/store/collections`; only active+visible products; tenant guard keyed by resolved store. Search per ADR 0014 Phase 1: `search_text` on our per-store `storefront_product` projection built by `normalizeForSearch()` (one TS/SQL normaliser in `packages/shared` sharing a test table: diacritics, alef/ya/ta-marbuta, digits, `unaccent` in an IMMUTABLE wrapper), `GIN (search_text gin_trgm_ops)`, matching with `word_similarity` (`<%`) and "ال" stripped from query words longer than 4 letters, plus a per-business Darija transliteration/synonym table applied to the query (seeded with common product words); Vendure's `DefaultSearchPlugin` is **not** used for Arabic search → commit `feat(storefront-api): public catalog endpoints`
3. i18n ar/fr/en with RTL/LTR from store language; message catalogues in `packages/shared` → commit `feat(storefront): i18n and rtl`
4. Theme JSON v0 (`{ tokens, pages: { home, product, collection, checkout, success, search }: Section[] }`) and a pluggable section registry/renderer (P8.S1 formalises the schema) with our own default Arabic-first theme → commit `feat(storefront): pluggable theme renderer`
5. Pages: home, `/products`, `/product/[slug]` (gallery, option pickers, quantity), `/category/[slug]`, `/search` → commit `feat(storefront): catalog pages`
6. `/cart`, `/checkout`, `/success` shells in the renderer; sold-out hide/show; SEO meta and sitemap; demo seed store at `demo.localhost:3000` → commit `feat(storefront): cart/checkout shells and seo`
7. Caching per ADR 0006: cacheComponents with 'use cache' + cacheTag('store:'+id, 'product:'+id, 'theme:'+id, 'offers:'+storeId) + cacheLife; the shared Redis cacheHandlers/cacheHandler chosen in spike F (the Next repo Redis example adopted by P0.S2b under `apps/storefront/cache/`, ISR keys prefixed by the deployment id, ADR 0006; cacheMaxMemorySize: 0); deploymentId = generateBuildId = GIT_SHA; constant NEXT_SERVER_ACTIONS_ENCRYPTION_KEY; assetPrefix https://cdn.<root>/sf; Cloudflare-CDN-Cache-Control max-age=60, stale-while-revalidate=600 on tenant pages (no-store while an A/B test is active); proxy.ts 404s incoming /_t and /_internal paths; product/landing/home routes never read searchParams; internal POST /_internal/revalidate (HMAC); the Cloudflare purge after a revalidate is coalesced per store (one purge per store per 30 s) and batched (up to 100 hostnames/tags per request), because Cloudflare Free allows 5 purge requests per minute (ADR 0006, 0012); same-origin /api/store/* route handlers proxying to the internal API with the resolved store injected; custom next/image loader for preset widths → commit `feat(storefront): shared cache, revalidation and same-origin store api`

**Deliverables:** `apps/storefront`, `plugins/storefront-api`, theme JSON types in `packages/shared`, demo seed.

**Acceptance criteria**
- [ ] Two stores of different businesses are served on `a.localhost` and `b.localhost` from the same app with their own name, logo, products and language.
- [ ] Arabic store renders `dir=rtl`; French/English render `ltr`; changing store language in settings changes the storefront.
- [ ] `/store/products`, `/store/product/:slug`, `/store/product/search?q=` return only active, visible products of the host's store; hidden/draft products 404; sold-out products follow the keep/hide setting.
- [ ] Product page option pickers (colour/size) switch variant image and price; quantity selector works.
- [ ] Swapping the default theme JSON for another changes the layout with no code change.
- [ ] Unknown host returns a 404 page and never another tenant's data.
- [ ] Two storefront instances share one Redis: a page cached via instance A is a cache hit on B; revalidateTag('store:<id>') from either instance refreshes both within 1 s.
- [ ] A test fails if any module under app/_t/ calls cookies() or headers(); tenant pages emit Cloudflare-CDN-Cache-Control with max-age and no Set-Cookie; GET <storeA host>/_t/<storeB id>/ returns 404.
- [ ] Browser calls to /api/store/* never carry a client-supplied storeId that is trusted; a mismatching storeId is rejected.
- [ ] Search on the spike E fixture (Arabic with/without diacritics, hamza variants, "ال", French, Latin Darija) reaches recall@5 ≥ 0.85; the TS and SQL normalisers pass the same test table (ADR 0014).
- [ ] 50 publishes for one store within a minute produce at most one Cloudflare purge request per store per 30 s, batched across stores (mocked Cloudflare client).

**Verification**
- Unit: host resolver, theme-JSON validation, i18n fallbacks. Integration: each public endpoint incl. 404/visibility cases. Playwright smoke: home → product → search on two hosts.
- Browser: home and product page vs `second-pass.md` "Storefront order → delivered" step 1 and "Builder page templates → Home / Product page" (section order only, no copying of visual identity).
- Multi-tenant: a product slug of store A requested on host B returns 404; search never leaks across stores.

**Out of scope:** COD form, quotes, order submit (P3.S3/P3.S4), builder and section library (P8.*), custom-domain verification (P8.S9).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P3.S2 "Multi-tenant storefront skeleton" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P3-storefront-checkout.md (section P3.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p3-s2-storefront-skeleton from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P3.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P3.S3 — Product page, COD form, cart & checkout

| Field | Value |
|---|---|
| **Goal** | Complete the buyer flow up to submit: variant pickers, in-page COD form with wilaya→commune and home/desk prices, live shipping and cart quotes, cart and checkout pages, discount-code field, success page. |
| **Branch** | `feat/p3-s3-cod-checkout` |
| **GitHub issue** | `P3.S3 Product page, COD form, cart & checkout` (label `phase-3`, milestone `P3 Storefront & COD checkout`) |
| **Prerequisites** | P3.S1, P3.S2, P2.S4 merged |
| **Parallel-safe** | Only with P2.S5 and P3.S5. Owns `apps/storefront/src/checkout/**`, `apps/storefront/src/cart/**`, `plugins/storefront-api/src/quotes/**`. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered**
- COD order form on product page: full name, phone, wilaya → commune, delivery type, live delivery fee and total (cart quote), Buy it now / Add to cart / Confirm order (form and quotes here; submit calls the P3.S4 endpoint, mocked until it lands)
- Storefront: home, product list, product page with variant pickers and quantity, cart, category, search (cart and checkout parts)
- Storefront pricing engine: cart-quote with offers applied/skipped + reasons, upsell nudge ("add 1 more, save X"), signed quote token, shipping-quote (base, overweight, waived, speed) (HTTP endpoints over the P2.S4 engine and P3.S1 service)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P3.S1, P3.S2, P2.S4
- `docs/research/data-model.md` → "Storefront ordering protocol" items 1–3 (shipping-quote and cart-quote request/response, `quoteToken`, `nudge`, `applied`, `skipped`, `rejectedCodes`)
- `docs/research/second-pass.md` → "Storefront order → delivered" step 1 (Arabic default theme form), "Builder page templates" (Product Info and In-Page Checkout settings: default delivery type, option style, show address/note, sticky button)
- `docs/research/api-surface.md` → "Added in the second pass → Storefront"

**High-level plan**
1. `POST /store/shipping-quote` over `ShippingQuoteService`, public and rate-limited → commit `feat(storefront-api): shipping-quote endpoint`
2. `POST /store/cart-quote` over `PricingService.quote()` + HMAC `quoteToken` (P2.S4); map `available:false` and `rejectedCodes` → commit `feat(storefront-api): cart-quote endpoint`
3. COD form: name, phone (05/06/07 → +213 E.164), wilaya, commune with "(desk available)" label from `isStopdesk`, home/desk radio with live prices, address/note per store settings, localized validation messages → commit `feat(storefront): cod form fields`
4. Live quote wiring: debounced cart-quote on any change, order summary (lines, discounts, delivery, total), nudge text, "cash on delivery" total label, preselected quantity tier → commit `feat(storefront): live quote and summary`
5. Buy now / Add to cart (persistent cart), cart page, checkout page reusing the form, discount-code field with accepted/rejected feedback → commit `feat(storefront): cart and checkout pages`
6. Submit handler against the P3.S4 contract (mock adapter until merged); `/success` page with thank-you copy → commit `feat(storefront): submit flow and success page`

**Deliverables:** quote REST endpoints, COD form + summary components, cart/checkout/success pages, store form config reading (show address, show note, default delivery type), Playwright spec for the flow.

**Acceptance criteria**
- [ ] A phone not starting 05/06/07 or of wrong length is rejected client- and server-side; valid input is sent as `+213…`.
- [ ] Choosing a wilaya loads its communes; communes with a stop-desk show the desk label; a commune without a desk disables the desk option.
- [ ] Switching home/desk updates fee and total within one quote round-trip; an undelivered wilaya shows a clear message and disables submit.
- [ ] Quantity change re-quotes; a quantity-offer tier shows the discounted price and nudge text; an invalid code shows `rejectedCodes` feedback, a valid code lowers the total.
- [ ] `quoteToken` is returned with `expiresAt` (~15 min); an expired token triggers a silent re-quote before submit.
- [ ] Add to cart persists across reload; cart page edits quantity and removes; checkout reuses the form.
- [ ] RTL and LTR layouts are correct at 375 px width with no horizontal scroll.

**Verification**
- Unit: phone normaliser, form validation, quote request builder. Integration: both quote endpoints (offer applied, skipped, code rejected, free delivery, tampered token). Playwright: fill form → displayed total equals API total.
- Browser: behaviour vs the Arabic default theme flow in `second-pass.md` "Storefront order → delivered" step 1.
- Multi-tenant: quoting store B's product with store A's `storeId` is rejected; token claims `b`/`s` must match the host's store.

**Out of scope:** creating the order and abandoned-checkout capture (P3.S4), builder-driven form settings (P8.*), spam logic (P4.S5).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P3.S3 "Product page, COD form, cart & checkout" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P3-storefront-checkout.md (section P3.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p3-s3-cod-checkout from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P3.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P3.S4 — Order intake & abandoned checkouts

| Field | Value |
|---|---|
| **Goal** | Accept storefront orders securely: verify the signed quote, create a pending Vendure order with attribution and anti-bot signals, capture abandoned checkouts and visitors, emit `OrderPlaced`. |
| **Branch** | `feat/p3-s4-order-intake` |
| **GitHub issue** | `P3.S4 Order intake & abandoned checkouts` (label `phase-3`, milestone `P3 Storefront & COD checkout`) |
| **Prerequisites** | P3.S3 and P1.S6 merged |
| **Parallel-safe** | Only with P3.S5. Owns `plugins/order-intake/**` (incl. the `cod_order` / `cod_order_item` / `order_counter` read-model tables and the intake spool), `packages/shared/src/events/order-placed.ts`, `packages/shared/src/intake/**`. |
| **Model / size** | Opus · L |
| **External needs** | Cloudflare Turnstile site/secret key; until provided, Cloudflare's published Turnstile test keys (always-pass / always-fail). |

**Inventory rows covered**
- Order source attribution: channel (store, dashboard, integration), traffic source, campaign/ad/UTM (capture here; display in P4.S3)
- Abandoned checkouts captured from storefront form — `/orders?status=abandoned`
- Abandoned checkout capture from form — `/orders/abandoned-checkouts/public`
- Visitor tracking and live beacon (live visitors) — `/visitors/track`, `/live/beacon`, `/live/snapshot`
- Anti-bot signals on order submit: deviceId, page/form fill time, fbp
- Order numbering per business (#00000001) (sequence service from P1.S1; number assigned at acceptance here)
- Storefront pricing engine: … signed quote token … (verification side)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P1.S1 (order-number sequence, tenant guard), P1.S6 (outbox, flags, internal HMAC guard), P2.S4 (quote-token verify), P3.S3; ADR 0004 (quote → Vendure order totals), ADR 0009 (order lifecycle, intake creation path, §7 business-scoped guest customer, §8 `cod_order` read model), ADR 0012 (Turnstile from one `challenge.<platform>` host), ADR 0016 (outbox, §6 pooling), the ADR 0009 addendum (intake lock contention)
- `docs/architecture/system-design.md` §2.2 (cart quote → order intake, incl. "Degraded mode" intake spool), §4 (per-tenant limits, CGNAT-safe rate limits)
- `docs/research/data-model.md` → "Storefront ordering protocol" items 4–5 and the trailing paragraph (abandoned and public order payloads/responses), "Order (dashboard)" (target shape), "Spam hold" (hold happens before a number exists)
- `docs/research/second-pass.md` → "Storefront order → delivered" steps 2–4 (abandoned recorded early; number assigned on release when held)
- `docs/research/api-surface.md` → "Added in the second pass → Storefront"

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #127 PKG-8 (medium): feat(config): add the id lint and shared Id schema of ADR 0003
- #149 AUTH-7 (low): fix(auth): throttle the Shop customer account branches
- #150 AUTH-8 (low): fix(auth): check hostname and action in the Turnstile response
- #202 CO-1 (low): feat(auth): decide Turnstile on sign-up and settle ADR 0008 vs 0012

**High-level plan**
1. Shared: `OrderPlaced` event + payload type, `OrderIntakePayload` zod schema, source/channel enums → commit `feat(shared): order intake schemas and OrderPlaced event`
2. `POST /business/:bid/orders/public`: validate payload, verify `quoteToken` (signature, expiry, business/store, cart hash, total); on mismatch/expiry return 409 `QUOTE_MISMATCH` with a fresh quote; browsers reach these endpoints only as same-origin /api/store/orders and /api/store/abandoned on the store host (the P3.S2 proxy route handlers inject the host-resolved store); the API routes /business/:bid/orders/public and …/abandoned-checkouts/public are internal-only (HMAC) per ADR 0006/0012, and a body businessId/storeId that differs from the injected store is rejected → commit `feat(order-intake): public order endpoint with quote verification`
3. Create the Vendure order in `pending` exactly as ADR 0009 prescribes (minimal custom `OrderProcess` with the `Pending` state, which P4.S1 later extends; order creation path and Customer handling per the ADR) and with totals forced to the signed quote via the ADR 0004 strategy (line prices, shipping, discount adjustments, zero tax), plus `orderClient`, items, shipping price/speed/stopdesk, applied offers/discounts, attribution (UTM, fbp, referrer, channel), `deviceId`, `pageMs`, `formMs`; assign number from the business sequence; apply the store's default delivery agent if any; in the same transaction insert the cod_order / cod_order_item read-model rows and bump order_counter (ADR 0009 §8), and write outbox order.placed via OutboxService (ADR 0016). **The whole intake runs in one DB transaction** (the COD payment is added outside the API's request handling, ADR 0009) and that transaction is kept **short**: all validation, quote verification and spam evaluation happen before it opens, and the order-number assignment and stock allocation run **last**, just before commit, because a burst on one hot product serialises on Vendure's stock-level row lock (ADR 0009 addendum) → commit `feat(order-intake): create pending order with attribution`
4. `SpamGate` interface (`evaluate(intake) → accept | hold | reject`) called before creation, default pass-through (P4.S5 plugs in); emit OrderPlaced through the outbox (same transaction), never as a fire-and-forget after commit → commit `feat(order-intake): spam gate hook and OrderPlaced event`
5. `POST …/orders/abandoned-checkouts/public`: upsert by `deviceId`+phone once name, phone, wilaya, commune are present; status `abandoned`; marked converted when the real order is placed; GraphQL listing for status `abandoned` → commit `feat(order-intake): abandoned checkouts`
6. `POST …/visitors/track`, `POST …/live/beacon`, live snapshot query (Redis TTL counters per store; beacons buffered in a Valkey stream and batch-flushed every 30 s into the partitioned `visitor_event` table via the P1.S6 partition helper); per-IP and per-device rate limits on all public endpoints; replace the storefront submit mock; Cloudflare Turnstile on submit, loaded from one challenge page/iframe on `challenge.<platform>` (one widget, one hostname: a Free widget allows only 10 hostnames) that posts the token to the parent page, verified server-side with `siteverify` checking `hostname = challenge.<platform>` and a 1.5 s timeout (ADR 0012; check it in in-app webviews, and skip Turnstile for a client where it fails); failure/timeout is passed to SpamGate as TURNSTILE_FAILED/TURNSTILE_UNAVAILABLE (never a hard reject); quote replay key quote:used:<hash> (SET NX, 1 h) plus unique cod_order.quote_hash; intake rate limits per (store, IP), (store, device) and 300/min per store (above it: hold, never drop) → commit `feat(order-intake): visitor tracking, beacon and rate limits`
7. Degraded-mode intake spool (system-design §2.2): when the transaction cannot start because Postgres is unreachable and the P1.S6 flag `intake.spool.enabled` is on, write the already-verified submit (quote token, form, signals) to the Valkey stream `{env}:intake:spool` (noeviction, capped 50 k) and answer `202`; the `intake-spool-replay` scheduled task replays it through the same intake service once `/readyz` is green (idempotent via `cod_order.quote_hash`); metric `intake_spool_length`; if Valkey is down too, answer `503` → commit `feat(order-intake): intake spool degraded mode`

**Deliverables:** `plugins/order-intake` (REST controllers, services, entities `AbandonedCheckout`, `VisitorSession`, read model `cod_order` / `cod_order_item` / `order_counter`, partitioned `visitor_event`), migrations, rate-limit config, Turnstile verifier, intake spool + `intake-spool-replay` task, real submit call in the storefront.

**Acceptance criteria**
- [ ] A valid submit returns 201 `{ id, status: "pending", total, shippingPrice, subtotal, discountTotal, discounts[], orderClient, orderItems[], track }`; the order has a `#00000001`-style number, unique and gapless per business.
- [ ] The order total equals the signed quote total; a tampered token, another store's token, changed items/total or an expired token is rejected with a re-quote payload and creates no order.
- [ ] The stored order carries `deviceId`, `pageMs`, `formMs`, `fbp`, UTM/referrer and `channel=storefront`; phone stored as `+213…`.
- [ ] An abandoned checkout is created only once name + phone + wilaya + commune are present, updated (not duplicated) on re-send, and marked converted after the order is placed.
- [ ] `OrderPlaced` fires exactly once per accepted order; a `SpamGate` returning `reject` creates no order and consumes no number.
- [ ] Beacon/track update the live snapshot; exceeding the per-minute limit from one IP/device returns 429.
- [ ] Resubmitting the same token + deviceId within 60 s returns the original order, not a second one.
- [ ] Killing the process after commit but before enqueue still produces exactly one OrderPlaced consumer run (outbox sweeper).
- [ ] With Turnstile's always-fail test key the order is held with reason TURNSTILE_FAILED, not rejected; the widget is served only from `challenge.<platform>` and a token whose `hostname` differs is treated as failed.
- [ ] The intake transaction takes the order number and the stock allocation as its last statements (code review + a test asserting statement order); 25 parallel submits on one hot product all succeed with gapless numbers.
- [ ] A quote mismatch between the token and a fresh recompute creates the order at the token's prices and increments pricing_quote_mismatch_total.
- [ ] Every accepted order has exactly one `cod_order` row whose status, totals and counters match the Vendure order; `order_counter` equals the count of pending orders per store. The `cod_order` + `order_counter` read model is the only source for merchant order lists, tab counts, filters and exports (keyset pagination; Vendure's `orders` list is staff-only: spike C took 2.6 s cold on a large store, ADR 0002, 0009 §9).
- [ ] With Postgres stopped and `intake.spool.enabled` on, 20 valid submits return 202; after Postgres returns, the replay creates exactly 20 orders (none twice, even if the replay task runs twice).

**Verification**
- Unit: token verification matrix; sequence concurrency (50 parallel submits → 50 distinct gapless numbers); abandoned upsert rules. Integration: both public endpoints, rate limit, event emission. Playwright: full flow from P3.S3 form to `/success`.
- Browser: place an order on `demo.localhost`, then see it pending in a `cod_order`-backed merchant view (not Vendure's built-in order list); compare the payload with data-model.md step 5.
- Multi-tenant: a `:bid` that does not own `storeId` is rejected; numbers are independent per business; A's abandoned list never shows B's; the same buyer phone ordering in business A and B creates two separate guest customers (business-scoped synthetic email, ADR 0009 §7); `cod_order` and outbox rows carry the right `businessId`.

**Out of scope:** full state machine and actions (P4.S1), spam engine and holding (P4.S5), notifications (P7.S3), plan quota masking (P9.S1).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P3.S4 "Order intake & abandoned checkouts" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P3-storefront-checkout.md (section P3.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p3-s4-order-intake from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P3.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P3.S5 — Staging environment, IaC & observability baseline

| Field | Value |
|---|---|
| **Goal** | Choose the Algerian VPS provider (ADR 0011) and stand up a persistent staging environment on it, with the edge built reproducibly (OpenTofu for Cloudflare/DNS) and the servers by runbook/Ansible + Kamal, the single role-based image, migrations as a release job, Cloudflare edge (wildcard subdomains, WAF, Turnstile, R2 for public assets), and the observability baseline, so carriers, Cloudflare for SaaS and payment sandboxes can call a public URL. |
| **Branch** | `chore/p3-s5-staging` |
| **GitHub issue** | `P3.S5 Staging environment, IaC & observability baseline` (label `phase-3`, milestone `P3 Storefront & COD checkout`) |
| **Prerequisites** | P3.S2 and P1.S6 merged. |
| **Parallel-safe** | Yes, with P2.*, P3.S3, P3.S4. Owns `Dockerfile`, `.dockerignore`, `infra/**`, `deploy/**`, `.github/workflows/deploy-staging.yml`, `docs/ops/**`, `otel/**`. Edits no plugin or app source (health endpoints already exist from P0.S2b). |
| **Model / size** | Opus · L |
| **External needs** | 🔑 trial VPSs at the shortlisted Algerian providers (ICOSNET, ISSAL, Algérie Télécom, ADEX; ADR 0011) and an account at the chosen one plus a second Algerian provider for backups, Cloudflare account with the `.com.dz` platform domain (staging zone), GitHub environment secrets. Until provided: everything runs locally (docker compose + `kamal` against a local VM or skipped), and the session stops at a "needs you" checklist. |

**Inventory rows covered:** none (infrastructure).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P0.S2b.md`, `P1.S6.md`, `P3.S2.md`; `docs/adr/` 0011 (hosting in Algeria, provider selection method), 0012, 0013, 0015, 0016 §6 (and 0006 for the spike F items left "pending" in P0.S2a).
- `docs/architecture/infrastructure.md` §1.1, §2 (§5 costs are superseded by ADR 0011); `docs/architecture/system-design.md` §3, §8, §9.

**High-level plan**
0. Provider selection (ADR 0011 Decision 4): a 1-month trial on the shortlist measuring CPU steal, disk `fsync` latency (pgbench) and RTT from Djezzy, Mobilis, Ooredoo and Algérie Télécom fixed lines (the spike G method; spike G itself must be closed before P10.S3), ARPCE cloud authorisation and DZD invoicing; record the results and the choice (primary + second provider for backups) in `docs/ops/provider-selection.md` and the ADR 0011 follow-ups → commit `docs(ops): algerian provider trial and choice`
1. Multi-stage Dockerfile producing one non-root image with `ROLE=api|worker|storefront|migrate`, graceful SIGTERM handling, OTel preload; CI job builds and pushes `ghcr.io/<org>/platform:<sha>`, uploads `.next/static` to R2 `sf/`, runs Trivy and SBOM → commit `chore(deploy): role-based image and build pipeline`
2. OpenTofu limited to Cloudflare/DNS (ADR 0011: Algerian providers have no API or Terraform provider): `infra/modules/{cloudflare,r2}` and `infra/envs/staging`; the staging VPS is provisioned by a documented runbook + Ansible/cloud-init (`infra/ansible/`: users, SSH hardening, firewall accepting 80/443 from Cloudflare IP ranges only, Docker, swap, `TZ=UTC`) and runs the P0.S2b compose data services (Postgres 17, PgBouncer transaction mode, Valkey, MinIO for private objects) with `pg_stat_statements` enabled (ADR 0015); pgBackRest with WAL archiving to the second Algerian provider. Cloudflare DNS (`*.staging.<root>`, `app.`/`api.`, `challenge.`), cache rule (query string ignored on product/landing/home paths, Edge TTL **"Respect origin"** so `Cloudflare-CDN-Cache-Control` decides, ADR 0012), WAF rule blocking `/store/*`, `/shop-api*`, `/_internal/*`, `/_t/*` on **every** host, Bot Fight Mode off, CGNAT-safe rate-limit rule, Turnstile widget (hostname `challenge.<root>`), R2 bucket `assets-prod` (public assets only; private objects stay in MinIO in Algeria, ADR 0012); state in R2 → commit `chore(infra): staging server runbook and opentofu edge`
3. Kamal 2 config (`deploy/staging.yml`): roles api/worker/storefront on the host with memory limits and heap flags (infrastructure.md "Launch node budget"), kamal-proxy host rules (app/api/api.internal → api, default → storefront), pre-deploy hook running the `migrate` role (`kamal app exec --version`) to completion before any api/worker container starts (ADR 0013), api/worker on the pooled `DATABASE_URL` and migrate on `DATABASE_URL_DIRECT` (ADR 0016 §6), per-container health checks on `/readyz` (never Vendure's `/health`, ADR 0015) and the node-level `/api/readyz`, backups (pgBackRest + nightly encrypted dump to the second provider), secrets from GitHub environment; record measured RSS per role → commit `chore(deploy): kamal staging deploy with migrate hook`
4. `deploy-staging.yml`: on merge to main → build → migrate → rolling deploy → Playwright smoke + k6 smoke (synthetic test store) → warm-up of top pages; a k6 **flash-sale** scenario (one business, one hot product, burst of parallel intakes) records intake p95 and lock waits (ADR 0009 addendum); failure → `kamal rollback` → commit `ci(deploy): staging pipeline with smoke and rollback`
5. Observability baseline: OTel Collector container, Grafana Cloud stack (Free), Sentry projects, Cloudflare Web Analytics, pick the uptime tool (ADR 0015 pending item) and check `/readyz`, one storefront page and intake (never `/health`); `pg_stat_statements` panel and slow-query report; queue gauges (waiting/active/failed/delayed, oldest-waiting age) computed **per job name**, because Vendure keeps all its queues in one BullMQ queue (ADR 0015); dashboards "Is buying working?", "Queues" and "Data tier"; first alerts (5xx rate, readyz down, outbox lag, webhook backlog, Valkey memory) → commit `chore(ops): observability baseline and first alerts`
6. Spike F (f)/(g) on the staging zone (ADR 0006): a cached tenant page is stored with the TTL from `Cloudflare-CDN-Cache-Control`, and two URLs differing only by `fbclid` hit one edge entry; if (g) fails, implement the Transform Rule / Worker branch; record results in ADR 0006's follow-ups. Cloudflare purge client coalesced per store and batched (Free 5 requests/min, ADR 0012).
7. Runbook `docs/ops/runbook.md` (server rebuild, deploy, rollback, migrate, pgBackRest restore into a fresh VPS, PG upgrades, MinIO, Cloudflare DNS-only fallback), a scheduled monthly automated restore test (ADR 0011), and chaos checks (stop Valkey; stop worker; kill PG connection) with observed behaviour → commit `docs(ops): staging runbook and chaos results`

**Deliverables:** Dockerfile, CI image job, `infra/` modules + staging env, `deploy/` Kamal config, staging pipeline, observability config, runbook, "needs you" checklist.

**Acceptance criteria**
- [ ] The provider trial results (CPU steal, `fsync` latency, RTT per Algerian ISP) and the chosen primary and backup providers are recorded (ADR 0011).
- [ ] `tofu plan` (Cloudflare/DNS) on a clean checkout shows no drift after apply; a fresh VPS rebuilt from the runbook/Ansible reproduces staging with only the documented manual steps (account, VPS order, domain).
- [ ] A pgBackRest point-in-time restore from the second provider into a fresh VPS passes the smoke test; no private object or backup is written to R2.
- [ ] `https://demo.staging.<root>` serves the storefront over valid TLS through Cloudflare; `api.staging.<root>/store/*` returns 403 at the edge; `app.staging.<root>` serves the dashboard login.
- [ ] A merge to main deploys staging with zero failed requests during rollout (k6 constant load during deploy shows no 5xx) and runs migrations before rollout.
- [ ] Stopping the worker triggers the queue/outbox alert within 10 min; stopping Valkey keeps cached storefront pages serving and the intake path degrades as documented; stopping Postgres with `intake.spool.enabled` turns submits into 202s that are replayed exactly once when it returns (checked once P3.S4 is merged; before that, recorded as pending in the handoff).
- [ ] Two requests to the same product URL with different `fbclid` values: the second is an edge HIT (`cf-cache-status`), and the edge TTL follows `Cloudflare-CDN-Cache-Control` (spike F (f)/(g)).
- [ ] On first deploy to an empty database, api/worker start only after `migrate` succeeded; every container runs with `TZ=UTC`.
- [ ] No secret in the repo, image layers or logs (secret scan + `docker history` check).

**Verification**
- Pipeline run evidence, k6 output (incl. the flash-sale scenario), alert screenshots in the PR; `tofu plan` output after apply; provider trial numbers; restore evidence.
- Browser check: storefront on a staging subdomain and the dashboard login on `app.staging.<root>` (no reference-product screen; note it).
- Multi-tenant: two seeded stores on two staging subdomains never serve each other's catalog; host-header spoof returns 404.

**Out of scope:** production (P10.S3), custom domains (P8.S9), Postgres standby/HA (Growth), Kubernetes (never, ADR 0011).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P3.S5 "Staging environment, IaC & observability baseline" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P3-storefront-checkout.md (section P3.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch chore/p3-s5-staging from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Never handle cloud or GitHub tokens: ask me to create accounts and secrets myself.
Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P3.S5.md` → commit → push → `gh pr create` → report PR link → stop.
