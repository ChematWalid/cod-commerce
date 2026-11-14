# P2 — Catalog & offers

**Phase goal:** products, variants, packs, collections, the 7-kind offer engine.

**Exit criteria (from README):** Products with variants/packs managed in admin; every offer kind priced correctly by the pricing service in unit tests.

**Session order and lanes:**
- P2.S1 (products) first; P3.S1 (geo + delivery pricing) and P3.S2 (storefront skeleton) may run next to it/after it per README.
- After P2.S1 merges: three lanes in parallel worktrees: **P2.S2** (packs/import), **P2.S3** (collections), **P2.S4** (offer engine core).
- P2.S5 starts after P2.S4 merges; it may run alongside P2.S2, P2.S3 and P3.S2.
- Shared registration files (append-only): `apps/server/src/vendure-config.ts`, `packages/shared/src/index.ts`, dashboard nav registry from `plugins/admin-shell`.

Brief structure: [_session-template.md](_session-template.md). Rules: [CONTRIBUTING.md](CONTRIBUTING.md). Binding ADRs: 0002 tenancy, 0003 ids, 0004 pricing/quote token, 0005 i18n, 0007 branding.

---

## P2.S1 — Products & variants

| Field | Value |
|---|---|
| **Goal** | Product catalog in admin: Tassyir-equivalent product fields, variant matrix, list with filters, media library and sold-out behaviour, on top of Vendure products. |
| **Branch** | `feat/p2-s1-products` |
| **GitHub issue** | `P2.S1 Products & variants` (label `phase-2`, milestone `P2 Catalog & offers`) |
| **Prerequisites** | P1.S5 merged (admin shell; tenancy from P1.S1). |
| **Parallel-safe** | Yes with P3.S1, P1.S6. Owns `plugins/catalog/`, `packages/shared/src/catalog.ts`. |
| **Model / size** | Sonnet · L |
| **External needs** | None (local asset storage; CDN adapter interface only). |

**Inventory rows covered**
- "Product list: All / Draft; filters collection, brand, tag; search name/SKU/barcode; preview, edit, customize page, set draft" (C).
- "Product form: title, rich-text description, main + additional images, price, old price, SKU, weight, package size, variants (options × values), status Active / Hidden (landing-page only) / Draft, brand, collections, tags, custom fields, highlights (max 6), SEO listing" (C).
- "Product settings: name on delivery label, fragile, keep selling when out of stock, quantity rules, dedicated order managers" (C).
- "Sold-out behaviour: keep showing or hide; stop/resume orders" (C).
- "YouCan / Ayor / Shopify order & product sync; media library" — **media library only** (sync is P9.S6).
- "Product types incl. Pack…" — physical type only here; Pack is P2.S2.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- docs/roadmap/plans/P2.S1-plan.md (executable plan)
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P1.S5.md`, ADR 0002 (tenant scoping), ADR 0003 (ids).
- D500 in `docs/roadmap/P1-decisions.md` (#229): Vendure's `slugForEntity` is platform-staff only, so product and collection slug checks need a business-scoped endpoint of `plugins/catalog` (the stock dashboard slug field calls the refused query).
- `docs/research/data-model.md` "Product" (Product, ProductOption, ProductVariant field lists, image CDN note).
- `docs/research/second-pass.md` "Products" (create, image upload, variants matrix with auto SKU `<sku>-n`, Custom Price, Hidden, edit-page sections Offers / Store page / Details-Add Landing Page tabs).
- `docs/research/dashboard-captures.md` "Products `/stores/:storeId/products`" and "Store settings → Profile → Sold-out products"; `api-surface.md` "Catalog & store" (`/products`, `/products/categories`, `/product-tags`, `/product-highlights`, `/brands`, `/upload`, `/stores/:id/sold-out-products(+/stop-orders,/resume-orders)`, `/media`).

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #108 TEN-3 (medium): fix(tenancy): enforce archive and suspension on every handler
- #122 TPL-2 (medium): fix(template): register the notes page through registerShellPage
- #124 SHELL-3 (medium): fix(shared): close the gaps in i18n:check
- #125 SHELL-4 (medium): fix(config): widen the dashboard style gate
- #170 TPL-3 (low): fix(server): stop registering the template plugin in production
- #171 TPL-5 (low): fix(template): reject a NUL character in a note title
- #172 TPL-7 (low): test(template): give the createTemplateNote control row an assertion
- #173 SHELL-1 (low): test(merchant-shell): check stock selectors and route ids on PRs
- #174 SHELL-5 (low): docs(merchant-shell): record that browser tests replaced component tests
- #175 SHELL-6 (low): fix(merchant-shell): remove the P0 placeholder route
- #176 SHELL-7 (low): test(merchant-shell): use a real foreign store in the not-found test
- #177 SHELL-8 (low): fix(merchant-shell): block a second Create Store submit after a timeout
- #178 SHELL-9 (low): fix(merchant-shell): show the business logo on /settings
- #179 SHELL-10 (low): fix(merchant-shell): stop importing a stock dashboard internal
- #207 CO-6 (low): feat(merchant-shell): build the store profile settings UI
- #210 CO-9 (low): feat(shared): add the tenantKey helper of ADR 0002

**High-level plan**
1. Map the model onto Vendure: Product/ProductVariant/ProductOption(Group) reused; custom fields on Product (oldPrice, nameInDelivery, isFragile, allowOutOfStockOrders, quantityRulesEnabled/minQuantity/quantityStep, allowParcelOpening, orderManagers[], cardCaption, label, status active|hidden|draft, highlights[] max 6, customFields[], brand, tags) and on Variant (oldPrice, isHidden); weight/width/height/length; every custom entity carries businessId/storeId; money as integer DZD per ADR 0004 → commit `feat(catalog): product and variant custom fields and tenant scoping`.
2. Domain services: SKU auto-generation (`<sku>-n`), slug uniqueness per store, status rules (Hidden = reachable only by landing page, not listed), variant matrix generation from options × values keeping edits to existing variants, price/oldPrice validation → commit `feat(catalog): variant matrix, sku and slug services`.
3. Brands, tags, highlights, SEO (metaTitle/metaDescription) entities/endpoints and Collections link points (collections themselves P2.S3) → commit `feat(catalog): brands, tags, highlights and seo fields`.
4. Media library: upload endpoint (≤5 MB images), asset entity per business, picker API, storage adapter interface (local now, CDN later) → commit `feat(catalog): media library and image upload`.
5. Sold-out behaviour: per-store keep/hide applied in the catalog query layer and `stop/resume orders` toggles for sold-out products (consumed by storefront in P3.S2/P3.S3) → commit `feat(catalog): sold-out behaviour and stop resume orders`.
6. Dashboard: product list (tabs All/Draft, filters, search, actions menu), create/edit form with rich-text description, image gallery, options editor (add values with Enter, drag to reorder), variants table (Variant image, Options, SKU, Custom Price, Hidden), settings section, SEO → commit `feat(catalog): product list and editor dashboard pages`.

**Deliverables**
- `plugins/catalog` (custom fields, services, GraphQL + REST `/business/:bid/products`, `/brands`, `/product-tags`, `/upload`, `/media`), dashboard pages under Products, seed of 5 demo products per demo business.

**Acceptance criteria**
- [ ] Creating a product with options Color (Red, Blue) × Size (S, M) generates 4 variants named "Product - Red / S", SKUs `<sku>-1..4`; editing one variant's price keeps the other three; hiding a variant sets `isHidden`.
- [ ] Status Draft hides the product from storefront queries; Hidden is excluded from lists/search but resolvable by slug for a landing page; Active is listed.
- [ ] Highlights above 6 are rejected; oldPrice < price is flagged (warning, not blocking).
- [ ] Product list search matches name, SKU and barcode (including variant SKUs); filters collection, brand, tag work together; tab Draft shows only drafts.
- [ ] Product settings fields save and reload: name on delivery label, fragile, keep selling when out of stock, quantity rules (min, step), dedicated order managers (stored as member/administrator ids; the picker uses `GET /employees/order-managers` from P1.S4 when merged, otherwise the business's administrators — P1.S4 is not a prerequisite).
- [ ] Sold-out behaviour Hide removes sold-out products from the public catalog query; Keep shows them with a sold-out flag; stop/resume orders toggles `allowOutOfStockOrders`-style gating.
- [ ] Uploading an image returns a URL and appears in the media library of that business only.

**Verification**
- Unit: matrix generator, SKU/slug, status visibility rules, quantity-rule validator. Integration: product CRUD GraphQL/REST, search, media upload.
- Browser check: product list and edit page vs "Products" in `dashboard-captures.md` and "Products" in `second-pass.md` (variant table columns, tabs, filters).
- Multi-tenant check: business A's products, brands, tags, media and slugs are invisible to business B; the same slug may exist in two stores.

**Out of scope**
- Pack type, bulk edit, import/export (P2.S2), collections (P2.S3), offers panel on the edit page (P2.S5), landing pages and "Customize" template (P8.S2/P8.S7), AI image clean-up (P9.S7b), stock quantities (P6.S1), storefront rendering (P3.S2/P3.S3).

**Kickoff prompt**
```
You are running session P2.S1 "Products & variants" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P2-catalog-offers.md (section P2.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p2-s1-products from an up-to-date phase/P2 (PR into phase/P2, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P2.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P2.S2 — Packs, import & export

| Field | Value |
|---|---|
| **Goal** | Pack (bundle) products with pricing/variant/weight modes, bulk edit, export, and spreadsheet import (analyze → preview → confirm) plus a link-import stub. |
| **Branch** | `feat/p2-s2-packs-import` |
| **GitHub issue** | `P2.S2 Packs, import & export` (label `phase-2`, milestone `P2 Catalog & offers`) |
| **Prerequisites** | P2.S1 merged. |
| **Parallel-safe** | Yes with P2.S3, P2.S4, P3.S5. Owns `plugins/catalog-packs/` (new folder; do not edit `plugins/catalog` beyond registering the type) and `plugins/catalog-import/`. |
| **Model / size** | Sonnet · M |
| **External needs** | None. Link import uses a fixture HTML scraper; AI polish and image clean-up are no-op hooks for P9.S7b. |

**Inventory rows covered**
- "Product types: physical product and Pack (bundle)" (C).
- "Bulk edit, export" (S).
- "Import products from a link (scrape + AI polish) or spreadsheet (analyze → preview → confirm)" (S) — spreadsheet fully; link scrape as a stub; AI polish deferred to P9.S7b.
- "Product types incl. Pack (bundle pricing/variant/weight modes); AI image clean-up; product store-page template" (S) — pack modes only (AI clean-up → P9.S7b; template → P8.S2).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P2.S1.md`.
- `docs/research/data-model.md` "Product" (`type: PHYSICAL | (PACK)`, `packPricingMode`, `packDiscountType`, `packDiscountValue`, `packVariantMode`, `packSharedOption`, `packWeightMode`, `bundleId`, `source`, `importJobId`, `scrapImportNeedsImageReview`) and "Order" `orderItems.bundleId/packParentItemId`.
- `docs/research/api-surface.md` "Catalog & store": `/products/bulk-edit`, `/products/export`, `/import-export/fields`, `/import-export/formats`, `/import-export/products/analyze`, `/import-export/products/imports/:id` (+ `/preview`, `/confirm`), `/scrape/import-job`, `/scrape/products/:id/polish`.
- `docs/research/dashboard-captures.md` "Products" (Import Products, Export buttons).

**High-level plan**
1. Pack model: Pack product = parent with component lines (product/variant, quantity); enums for pricing mode (e.g. fixed price vs sum minus discount), discount type percent|amount + value, variant mode (per-component options vs shared option via `packSharedOption`), weight mode (sum vs fixed); the exact enum values are decided in this session and recorded in the handoff note; price calculation exported as a pack `UnitPriceResolver` (README "Shared contracts"): if P2.S4 is already merged register it in the offers pricing service with one line, otherwise P2.S4 registers it → commit `feat(catalog-packs): pack product type and pricing modes`.
2. Pack editor UI (component picker, preview of computed price/weight) and order-item expansion helper (`bundleId`, `packParentItemId`) for later order sessions → commit `feat(catalog-packs): pack editor and order item expansion helper`.
3. Bulk edit endpoint + UI (select products → change status, collection, brand, tags, price ±%/fixed) with audit rows and dry-run summary → commit `feat(catalog): bulk edit products`.
4. Export: fields/format catalog (`/import-export/fields`, `/formats`), Excel (xlsx) and CSV, selected/filtered scope, background job on the BullMQ queue for >500 rows → commit `feat(catalog-import): product export`.
5. Import (uploaded files and per-row error reports are private objects: presigned upload to the S3-compatible object storage in Algeria (MinIO), never R2, ADR 0011/0012): upload → analyze (detect columns, map to fields, row count) → preview (valid/warning/error rows, create vs update by SKU) → confirm (job, progress, per-row error report); `source=import`, `importJobId` stored → commit `feat(catalog-import): spreadsheet import analyze preview confirm`.
6. Link import stub: `POST /scrape/import-job {url}` fetches title/description/images/price via a pluggable scraper (SSRF guard: public http(s) only, no private IPs, size/time caps), creates a Draft with `scrapImportNeedsImageReview=true`; polish endpoint returns the input unchanged and an `ImageCleanup` hook returns the input image, both hidden behind flags for P9.S7b → commit `feat(catalog-import): link import stub and ai hooks`.

**Deliverables**
- `plugins/catalog-packs`, `plugins/catalog-import`, REST `/import-export/*`, `/products/bulk-edit`, `/products/export`, `/scrape/*`, dashboard Pack form and Import/Export dialogs, sample xlsx fixtures.

**Acceptance criteria**
- [ ] A Pack of 2 components with percent discount 10% computes price and weight per the chosen modes; shared-option mode produces one option matrix applied to every component.
- [ ] Import of a 100-row fixture reports a preview with counts (create/update/error), errors list row numbers and reasons, and confirm creates/updates exactly the previewed rows; re-import updates by SKU instead of duplicating.
- [ ] Export of filtered products yields Excel and CSV that re-import cleanly (round trip).
- [ ] Bulk edit changes N selected products in one call and records which fields changed; one invalid product does not block the rest (reported in the response).
- [ ] Link import of a fixture URL creates a Draft product flagged for image review.
- [ ] Imports and exports are scoped to the active store; a file referencing another business's SKU does not touch it.

**Verification**
- Unit: pack price/weight calculators for each mode, column mapper, row validator. Integration: import analyze/preview/confirm endpoints, export job, bulk edit.
- Browser check: Import Products / Export buttons and flow on the product list per `dashboard-captures.md` "Products" (wizard-style steps).
- Multi-tenant check: import/export jobs and files are only retrievable by their owning business; job ids guessed from another business return not found; import and export files are written to the private Algerian bucket, never to R2 (ADR 0012).

**Out of scope**
- Real scraping hardening and AI polish / image clean-up (P9.S7b), stock import (P6.S1), platform sync (P9.S6), quote pipeline itself (P2.S4; this session only provides the pack `UnitPriceResolver`).

**Kickoff prompt**
```
You are running session P2.S2 "Packs, import & export" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P2-catalog-offers.md (section P2.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p2-s2-packs-import from an up-to-date phase/P2 (PR into phase/P2, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P2.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P2.S3 — Collections with conditions

| Field | Value |
|---|---|
| **Goal** | Collections with manual products or automatic All/Any conditions, live match preview, visibility and position. |
| **Branch** | `feat/p2-s3-collections` |
| **GitHub issue** | `P2.S3 Collections with conditions` (label `phase-2`, milestone `P2 Catalog & offers`) |
| **Prerequisites** | P2.S1 merged. |
| **Parallel-safe** | Yes with P2.S2, P2.S4, P3.S5. Owns `plugins/collections-rules/`. |
| **Model / size** | Sonnet · S |
| **External needs** | None. |

**Inventory rows covered**
- "Collections: image, title, description, manual products or automatic conditions, visibility, position" (C).
- "Collections with automatic conditions (All/Any; tag, brand, price, on sale, title, option values)" (C).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P2.S1.md`.
- `docs/research/second-pass.md` "Collections" (create page `/stores/:sid/categories/new`; "Products must match All / Any"; condition fields Tag, Brand, Price, On sale, Title + every product option name; operators "is any of" / "is not"; live "which products match" preview; manual Add products; Visibility; Organization/position).
- `docs/research/data-model.md` "Product" (`categoryId`, `categoryIds[]`, `collections[]`); `api-surface.md` "Catalog & store" (`/products/categories`); `dashboard-captures.md` "Collections `/stores/:storeId/categories`".

**High-level plan**
1. Map to Vendure `Collection` (filters) with a custom `CollectionFilter` per condition field (tag, brand, price range, on sale = oldPrice > price, title contains, option value); tenant/store scope on collections; custom fields image, visibility, position → commit `feat(collections-rules): collection filters for tag, brand, price, on sale, title, option`.
2. Rule model: `{ match: all|any, conditions:[{field, operator: is_any_of|is_not|…, values[]}] }` stored as JSON, validated by a zod schema in `packages/shared`; evaluation service that translates to filters and recomputes on product change events → commit `feat(collections-rules): rule schema and evaluation service`.
3. Live preview query `previewCollectionMatches(rule)` (paginated, count) and manual product assignment with ordering → commit `feat(collections-rules): match preview and manual products`.
4. Dashboard: collections list (store-scoped under Products → Collections) and editor with condition builder (field/operator/values; option-name fields loaded dynamically), image, visibility toggle, position → commit `feat(collections-rules): collections dashboard pages`.
5. Public read endpoint for the storefront (`/store/collections`, products by collection respecting hidden/draft/sold-out rules) → commit `feat(collections-rules): public collections query`.

**Deliverables**
- `plugins/collections-rules`, shared rule schema, GraphQL + REST `/products/categories`, dashboard pages, tests.

**Acceptance criteria**
- [ ] Conditions "Tag is any of [promo]" AND "Price between …" with match All returns the intersection; with match Any returns the union.
- [ ] "is not" negates correctly, including products with no tags/brand.
- [ ] Option-value conditions are offered for every option name present in the store (e.g. Color, Size) and match variants' options.
- [ ] Preview count updates as conditions change (debounced) without saving.
- [ ] Editing a product's tag or price updates automatic collection membership (event-driven recompute, tested).
- [ ] Hidden collections are excluded from the public query; position controls ordering; manual products keep their order.

**Verification**
- Unit: rule validation, operator semantics, All/Any truth table. Integration: filter evaluation against a seeded catalog, recompute on product update.
- Browser check: collection create page vs "Collections" in `second-pass.md` (All/Any selector, condition fields, live preview).
- Multi-tenant check: option names, brands and tags offered in the builder come only from the active store; collections of A never match products of B.

**Out of scope**
- Collection grid section rendering (P8.S3), collection storefront page (P3.S2), collection-based offer targets (P2.S4/P2.S5 consume this plugin's membership service).

**Kickoff prompt**
```
You are running session P2.S3 "Collections with conditions" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P2-catalog-offers.md (section P2.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p2-s3-collections from an up-to-date phase/P2 (PR into phase/P2, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P2.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P2.S4 — Pricing & offer engine core

| Field | Value |
|---|---|
| **Goal** | A pure, exhaustively tested pricing service that produces a cart quote (lines, discounts, applied/skipped, nudge, delivery block, totals, signed token) for the quantity, free-delivery, product-discount, discount-code and order-discount offer kinds. |
| **Branch** | `feat/p2-s4-offer-engine` |
| **GitHub issue** | `P2.S4 Pricing & offer engine core` (label `phase-2`, milestone `P2 Catalog & offers`) |
| **Prerequisites** | P2.S1 merged. |
| **Parallel-safe** | Yes with P2.S2, P2.S3, P3.S5. Owns `plugins/offers/` (entity, engine, token) and `packages/shared/src/pricing.ts`. No HTTP endpoints. |
| **Model / size** | Opus · L |
| **External needs** | None. Shipping quote is an injectable function (real one from P3.S1). |

**Inventory rows covered**
- "Offers: quantity offer, free delivery, product discount, discount codes, buy X get Y, order discount, add-on (pre/post purchase upsell)" (C) — **first five kinds here**; BXGY and add-on in P2.S5.
- "Offer engine: 7 kinds … with audience, channels, schedule, usage limits, combination rules, live Arabic preview, draft/publish, performance stats" (C) — engine, eligibility, schedule, limits, combination rules; UI/preview/stats in P2.S5.
- "Storefront pricing engine: cart-quote with offers applied/skipped + reasons, upsell nudge ("add 1 more, save X"), signed quote token, shipping-quote (base, overweight, waived, speed)" (C) — **engine part**; endpoints in P3.S3.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P2.S1.md`, ADR 0004 (pricing/quote token and how quotes become Vendure order totals — the engine must produce exactly the per-line and shipping numbers that strategy needs), ADR 0003; `docs/roadmap/handoff/P2.S2.md` if merged (pack resolver).
- `docs/research/data-model.md` "Offer" (entity, `config`, `combinesWith`, `eligibility`, limits, status, targets, performance) and "Storefront ordering protocol" steps 2–3 (shipping-quote shape; cart-quote request/response; quoteToken format `qt1.<base64url JSON {v,b,s,h,exp,t,sh,l,d,a}>.<HMAC>`, ~15 min).
- `docs/research/second-pass.md` "Storefront order → delivered" step 1 and 4 (nudge "add one more piece to save 980 DA"; "Now: 1 piece · 2 pieces: DZD 8,820 (+3,920) · 3 pieces … Free delivery") and "Offers (7 kinds)" shared parts and kinds 1–4, 6.
- `docs/research/api-surface.md` "Offers" lines.

**High-level plan**
1. Shared types/zod in `packages/shared/src/pricing.ts`: `QuoteRequest`, `Quote` (shape exactly as cart-quote response: currency, lines[{key, productId, variantId, quantity, originalPrice, unitPrice, totalPrice, discounts[]}], discounts[], subtotal, discountTotal, delivery{resolved, fee, overweightFee, waived, price, freeShipping, speed}, total, savings, nudge, applied[], skipped[{offerId, reason}], rejectedCodes[], suggestions[], quoteToken, expiresAt, available, orderPricingMode); integer DZD helpers; DZD money is stored with precision 0 by our custom `MoneyStrategy` (9 100 DZD stored as 9100, ADR 0004) → commit `feat(shared): pricing types and money helpers`.
2. `Offer` entity and repository in `plugins/offers` per data-model.md (kind, method automatic|codes, title, label, config, combinesWith, eligibility, totalUsageLimit, perBuyerLimit, status draft|active|paused|archived, startsAt/endsAt, targets[], codes, usage counters) with migration and tenant/store scoping → commit `feat(offers): offer and code entities`.
3. Engine core: pipeline (unit prices via the `UnitPriceResolver` port — default = variant price; register P2.S2's pack resolver here if P2.S2 is already merged → eligibility filter → per-kind calculators → combination resolution → totals) as pure functions taking offers + request + `shippingQuote(request)` injected; kinds quantity (tiers, percent|total price mode, preselected, per-tier free delivery), free_delivery (from N pieces or amount, home/desk/both, wilaya list), product_discount (percent|fixed, cap, targets product/variant/collection), discount codes (code lookup, per-code limit, `rejectedCodes` with reason), order_discount (percent|fixed, cap, minimum amount/pieces) → commit `feat(offers): pricing engine with five offer kinds`.
4. Eligibility and rules: audience everyone|first|returning (via injected buyer-history function), channels, wilayas, delivery methods, schedule (Algeria time UTC+1), usage limits, `combinesWith` {order, product, delivery}; best-offer selection when not combinable; `skipped` reasons (e.g. `no_tier_reached`, `not_started`, `ended`, `audience`, `channel`, `wilaya`, `usage_limit`, `not_combinable`) → commit `feat(offers): eligibility, schedule, limits and combination rules`.
5. Nudge + suggestions: compute `nudge {type: next_tier, offerId, units, tierQuantity, saving}` from the next reachable quantity tier; suggestions list for unmet free-delivery thresholds → commit `feat(offers): upsell nudge and suggestions`.
6. Quote token per ADR 0004: sign/verify (`qt1.`, HMAC-SHA256, key from env with rotation id), fields v/b/s/h/exp/t/sh/l/d/a, cart hash, expiry check, tamper tests; `verifyQuote(token, cart)` for P3.S4 → commit `feat(offers): hmac quote token sign and verify`.
7. Exhaustive tests incl. fixtures replicating the worked examples → commit `test(offers): worked examples and edge cases`.

**Deliverables**
- `plugins/offers` (entities, engine, token module, `PricingService` Nest provider exposing `quote(request)` for P3.S3 and `repriceOrder(order, offer)` for P4.S3), `packages/shared/src/pricing.ts`, test fixtures.

**Acceptance criteria**
- [ ] Worked example from research: a product with unit price 4,900 DZD and a quantity offer "2 pieces −10%" yields line total 8,820 for 2 pieces (`second-pass.md` panel: "2 pieces: DZD 8,820 (+3,920 for this order)", i.e. 8,820 − 4,900); the audit-diff example "Total 5,700 → 9,620" is reproduced as a second fixture with delivery added (state the assumed fees in the test); and the 3-piece tier with `freeDelivery:true` returns `delivery.waived=true`, `freeShipping=true`, `delivery.price=0`; test fixtures state the base unit price they assume.
- [ ] With 1 piece in cart and a 2-piece tier configured, `nudge` is `{type:'next_tier', units:1, tierQuantity:2, saving:<positive int>}`; with the highest tier reached, `nudge` is null.
- [ ] An offer outside its schedule appears in `skipped` with reason `not_started`/`ended`; a quantity offer below the first tier appears with `no_tier_reached`.
- [ ] Invalid or exhausted code appears in `rejectedCodes` with reason; valid code applies exactly once per order; per-buyer and total limits enforced using injected usage counts.
- [ ] Combination rules: two non-combinable order discounts → only the better one applies and the other is `skipped: not_combinable`; free-delivery offers combine with discounts when `combinesWith.delivery` allows.
- [ ] All amounts are integers; rounding rule is documented and tested (percent discounts round half-up to whole DZD).
- [ ] A token round-trips; altering total, a line quantity or the store id fails verification; an expired token fails; wrong business id fails.
- [ ] Engine is pure: no DB access inside calculators (verified by tests running without a database).

**Verification**
- Unit: ≥ 60 cases (each kind, each eligibility axis, combination matrix, rounding, token tamper) — all pass; coverage report for `plugins/offers/src/engine` ≥ 90% lines. Integration: entity CRUD + tenant scoping only.
- Browser check: none (no UI); compare computed outputs against the cart-quote payload described in `data-model.md`.
- Multi-tenant check: `PricingService.quote` called with store A's id never loads store B's offers or codes; a token signed for store A fails verification when presented with store B.

**Out of scope**
- HTTP endpoints `/store/cart-quote`, `/store/shipping-quote` (P3.S3 and P3.S1), BXGY and add-on kinds and the offers admin UI (P2.S5), order creation (P3.S4), real shipping fee resolution (P3.S1).

**Kickoff prompt**
```
You are running session P2.S4 "Pricing & offer engine core" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P2-catalog-offers.md (section P2.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p2-s4-offer-engine from an up-to-date phase/P2 (PR into phase/P2, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P2.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P2.S5 — Offer kinds BXGY/add-on & offers admin

| Field | Value |
|---|---|
| **Goal** | Add the BXGY and add-on kinds to the engine and build the full offers admin (list, 7-kind create dialog, editors, summary, Arabic preview, lifecycle, codes, stats). |
| **Branch** | `feat/p2-s5-offers-admin` |
| **GitHub issue** | `P2.S5 Offer kinds BXGY/add-on & offers admin` (label `phase-2`, milestone `P2 Catalog & offers`) |
| **Prerequisites** | P2.S4 merged. |
| **Parallel-safe** | Yes with P2.S2, P2.S3, P3.S2, P3.S5. Owns `plugins/offers/src/kinds/{bxgy,addon}`, `plugins/offers/dashboard/`. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered**
- "Offers: quantity offer, free delivery, product discount, discount codes, buy X get Y, order discount, add-on (pre/post purchase upsell)" (C) — completes the row (admin UI for all 7 kinds + BXGY and add-on engine).
- "Offer engine: 7 kinds (… ) with audience, channels, schedule, usage limits, combination rules, live Arabic preview, draft/publish, performance stats" (C) — completes the row (engine part ticked in P2.S4's PR as partial).
- "Storefront pricing engine…" — add-on and BXGY lines in the quote shape (endpoints remain P3.S3).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P2.S4.md`, ADR 0004.
- `docs/research/second-pass.md` "Offers (7 kinds)" — shared editor parts (name, Arabic headline, Automatic/With codes, Who and where, Shown on, Dates and limits, Combines with, live Summary and Arabic order-form preview, footer Discard / Save as draft / Publish) and kinds 1–7 (BXGY: buy N get M, gift Free/% off/fixed, most times per order, visible removable gift line; Add-on: 1–5 add-on products, price fixed/% off/amount off, pieces per order, checkbox in the form or one tap on the thank-you page while unconfirmed). Also "Products" edit-page "Offers section".
- `docs/research/data-model.md` "Offer" (`targets[{role: buy|get|addon,…}]`, `performance`, `codeCount`, lifecycle timestamps).
- `docs/research/api-surface.md`: `POST /stores/:sid/offers`, `/offers/:id/publish`, `GET /stores/:sid/offers/app-types`; `dashboard-captures.md` "Offers" and "Orders → Filters: Offer, Code".

**High-level plan**
1. Engine: BXGY calculator (buy targets, get targets same/other, buy N get M, gift price free|percent|fixed, max times per order, gift as removable line with `giftOf` metadata) and add-on calculator (candidate products 1–5, price modes, pieces per order, placement `order_form|thank_you`, accepted-state input in `QuoteRequest.addons`), with combination and nudge integration → commit `feat(offers): bxgy and addon calculators`.
2. Post-order add-on application API (`addAddonToOrder(orderId, addonId)` allowed only while order unconfirmed, repricing through the engine and emitting `OfferApplied`) as a service for P4.S1/P3.S4 to call; define `OfferApplied` event in `packages/shared/events` if absent → commit `feat(offers): post-order add-on service and OfferApplied event`.
3. Lifecycle & codes API: create draft, update, publish (validates targets exist and schedule), pause, resume, archive, duplicate; code generation (uppercase, per-code limit, bulk Generate); performance aggregate query (orders, deliveredRevenue, discountGiven — reads order data when available, zeros until P3.S4/P4.S1); `GET offers/app-types` returning the 7 built-in kinds with a registry for future app-defined kinds → commit `feat(offers): lifecycle, codes, stats and app-types endpoints`.
4. Dashboard list (status tabs, kind chips, performance columns) and "Create offer" dialog with goal cards (sell more, delivery, stock, influencers) and 7 kinds → commit `feat(offers): offers list and create dialog`.
5. Per-kind editors + shared sections; target pickers (variant/product/collection); live Summary card and Arabic order-form preview using the engine with a sample price (RTL preview component from admin-shell i18n) → commit `feat(offers): per-kind editors, summary and arabic preview`.
6. Product edit-page "Offers" section (list offers on the product, "Add a quantity offer") contributed to the P2.S1 editor via extension point; Arabic translations for all new strings → commit `feat(offers): product offers section and translations`.

**Deliverables**
- Engine kinds, services, GraphQL + REST `/stores/:sid/offers*`, dashboard pages, preview component, tests.

**Acceptance criteria**
- [ ] Create dialog offers exactly 7 kinds: quantity, free delivery, product discount, discount codes, buy X get Y, order discount, add-on; each opens its own editor with the shared sections.
- [ ] BXGY "buy 2 get 1 free": cart of 3 same items → the gift line price 0 and visible/removable; buying 5 with "most times per order = 1" gives one gift; gift from another product works; "gift 50% off" prices correctly.
- [ ] Add-on at order form: accepted add-on adds a line at the configured price; declined adds nothing; post-order add-on works only while status is pending/unconfirmed and fails with a clear error after confirm.
- [ ] Draft → Publish validates (title, at least one target, valid dates) and records `publishedAt`; Pause/Resume/Archive transitions are enforced; archived offers cannot be edited or published.
- [ ] Code generation yields unique uppercase codes per store; per-code usage limit stored; code-method offers never apply automatically.
- [ ] Summary and Arabic preview update live as fields change and match the engine's output for the sample price.
- [ ] Performance stats endpoint returns `{orders, deliveredRevenue, discountGiven}` (zero before orders exist; unit-tested aggregation with fixture orders).

**Verification**
- Unit: BXGY and add-on calculators, lifecycle state machine, code generator, post-order guard. Integration: offer REST/GraphQL, publish validation, stats aggregation.
- Browser check: Create dialog, quantity editor (tiers, % chips 5/10/15/20, preselected tier, free delivery per tier) and Arabic preview vs "Offers (7 kinds)" in `second-pass.md`.
- Multi-tenant check: offers, codes and stats of store A are not listable, editable or applicable from store B or another business; the same code string may exist in two businesses without collision.

**Out of scope**
- Storefront rendering of offers and quote endpoints (P3.S3), agent upsell panel on the order page (P4.S3), offer filter/code columns in orders list (P4.S2), A/B tests (P8.S8), third-party app offer kinds (P9.S8b).

**Kickoff prompt**
```
You are running session P2.S5 "Offer kinds BXGY/add-on & offers admin" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P2-catalog-offers.md (section P2.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p2-s5-offers-admin from an up-to-date phase/P2 (PR into phase/P2, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P2.S5.md` → commit → push → `gh pr create` → report PR link → stop.
