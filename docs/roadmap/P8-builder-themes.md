# P8 — Builder & themes

**Phase goal:** a section-based store builder with styles, themes, landing pages, A/B tests and custom domains, all rendered by the multi-tenant Next.js storefront.
**Exit criteria:** Merchant edits and publishes a store and a landing page; theme switch works; custom domain verified (staging).

**Session order / lanes**
- Lane A (critical): P8.S1 (Opus) → P8.S2 → { P8.S3, P8.S4, P8.S5 in parallel } → P8.S6.
- Lane B: P8.S7 (needs only P8.S1, so it can start right after S1, in parallel with S2–S6) → P8.S8.
- Lane C: P8.S9 (needs only P3.S2 and the P3.S5 staging environment) can run at any time, in parallel with everything in P8.
- P8.S1 is the only session that must run alone inside P8. P8 sessions can also run next to P6.* and P7.*.

**Shared conventions for the whole phase** (P8.S1 creates them, later sessions follow them)
- Our code: JSON schemas and types in `packages/shared/theme`; server logic and dashboard builder UI in `plugins/builder` (landing pages `plugins/landing-pages`, A/B `plugins/ab-tests`, domains `plugins/domains`); renderer and public routes in `apps/storefront`.
- **Section registry with auto-discovery:** one folder per section, `plugins/builder/src/sections/<id>/` (definition: id, name, allowed pages, typed settings schema, defaults, shared groups used, settings panel component) and `apps/storefront/src/sections/<id>/` (React renderer). A generated index (build-time glob, no hand-edited list) registers them, so P8.S3 and P8.S4 add sections only by adding folders. Group A sections live under folder names `layout-*`/content names listed in S3; group B in S4; never edit the other's folders.
- Own branding: never use the "Tassyir" name, logo or copy, nor its theme names (Nocturne, Merino, Linden, Focal, Majestic, Impulse, Studio, Volta) or its designs; our 10 presets are named in P8.S6.
- AI features (Ask for changes, the reference product's AI design tab, "Generate with AI −20 credits") are built in P9.S7b: here only leave clearly named extension points (`builder.ai.*`, `landingPages.ai.*`) and hidden buttons (README "Shared contracts" lists them).
- All dashboard UI is EN/AR with RTL; storefront output honours store direction RTL/LTR. Every endpoint is tenant-guarded (businessId + storeId).

---

## P8.S1 — Theme & section model + renderer

| Field | Value |
|---|---|
| **Goal** | Define the theme/page/section JSON model with draft vs published versions, the builder config API, and the SSR/ISR renderer, migrating the P3 minimal theme onto it. |
| **Branch** | `feat/p8-s1-theme-model` |
| **GitHub issue** | `P8.S1 Theme & section model + renderer` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P3.S3 |
| **Parallel-safe** | Must be alone in P8; can run next to P6.* and P7.*. Owns `packages/shared/theme/**`, `plugins/builder/**` (model, API, registry), `apps/storefront/src/renderer/**`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Builder: page templates (Home, Product pages incl. per-product override, Collection, Checkout, Success, Search); full section settings; styles (…); keyboard shortcuts; Tassya AI design tab — the data model, templates and renderer part (editor UI P8.S2, sections S3/S4, styles S5, AI P9.S7b)
- Visual builder: pages (…), draft vs published — the draft/published/history model only (UI is P8.S2)
- Storefront: home, product list, product page with variant pickers and quantity, cart, category, search — re-rendered through the new renderer (originally P3.S2/P3.S3; must not regress)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P3.S2`, `P3.S3`, and `P3.S4` if already merged (P3.S4 may still be open: it runs in parallel; rebase on it before the PR if it merges first)
- `docs/research/second-pass.md` → "Builder in detail" (shared section groups), "Builder page templates" (per-template section lists, per-product "Customize for this product only")
- `docs/research/api-surface.md` → "Added in the second pass" (`/store-preview`, storefront public API); `docs/research/dashboard-captures.md` → "Themes"
- ADRs on tenancy/multi-tenant storefront in `docs/adr/`

**High-level plan**
1. ADR + JSON schemas (zod + generated JSON Schema): `ThemeStyles` tokens, `PageTemplate` (home, product default / named / per-product override, collection, checkout, success, search, landing later), `SectionInstance` (id, type, settings, blocks, hidden), shared groups: Appearance (colour scheme Default/Tinted/Inverse/Accent/Custom, background image + overlay, shape dividers, image style Clean/Duotone), Spacing (top/bottom/start/end), Visibility (All/Desktop/Mobile) → commit `feat(builder): theme and section schemas`
2. Entities and migrations: Theme, ThemeVersion, PageDoc with draft + published JSON, history (publish creates a version), per-product override link; services publish/discard/revert → commit `feat(builder): draft and published persistence`
3. Section registry with build-time auto-discovery and a validation step (unknown section types, settings migrations by version) plus two placeholder sections to prove it → commit `feat(builder): section registry auto-discovery`
4. Builder config API: `GET/PUT /stores/:id/builder/config` (pages, sections, styles, draft), publish, history; permissions; tenant guard → commit `feat(builder): builder config api`
5. Storefront renderer: SSR of published JSON → React sections, styles → CSS variables, RTL/LTR, per-host theme lookup, ISR/tag-based revalidation on publish, `/store-preview` draft mode with signed token → commit `feat(storefront): json renderer with isr`
6. Migrate the P3 minimal theme JSON to the new schema with a migration script and default templates for every page (section lists as in "Builder page templates"); all P3 storefront pages render identically → commit `refactor(storefront): migrate minimal theme to new model`
7. Tests (schema validation, version history, renderer snapshots, cache invalidation, isolation) → commit `test(builder): model, api and renderer`

**Deliverables**
- Schemas and types, registry tooling, entities/migrations, builder config REST/GraphQL, storefront renderer and preview route, default page templates, migration script, ADR `docs/adr/NNNN-theme-model.md`.

**Acceptance criteria**
- [ ] Invalid theme/page JSON is rejected with path-level errors; every shared group validates.
- [ ] Editing writes only the draft; the storefront serves the last published version until publish; publishing creates a history entry and revalidates only that store's pages.
- [ ] A per-product override page takes precedence for that product only; others keep the default template.
- [ ] Adding a new folder under `sections/` registers it without editing any shared list (proved by a test fixture section).
- [ ] Existing P3 pages (home, products, product, category, search, cart, checkout, success) render with no visual or functional regression after migration.
- [ ] `/store-preview` shows draft content only with a valid signed token; the public host never shows drafts.
- [ ] Two stores with different themes on different hosts never share cached output.

**Verification**
- Unit tests for schema, migrations, publish/revert; integration tests for config API; renderer snapshot tests.
- Browser check: the P3 storefront flows (order a product with wilaya/commune) still work; compare layouts to "Builder page templates" lists.
- Multi-tenant: store A's config/draft/history is unreachable with business B's token; host A never renders store B's theme.

**Out of scope**
- Editor UI (P8.S2), concrete sections (P8.S3/S4), styles UI (P8.S5), preset themes (P8.S6), landing pages (P8.S7).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S1 "Theme & section model + renderer" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s1-theme-model from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S2 — Builder editor shell

| Field | Value |
|---|---|
| **Goal** | Build the visual editor: canvas preview, page switcher, section list with reorder/hide/delete/rename, settings panel host, undo/redo, preview and publish. |
| **Branch** | `feat/p8-s2-builder-shell` |
| **GitHub issue** | `P8.S2 Builder editor shell` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S1 |
| **Parallel-safe** | Yes — with P8.S7 and P8.S9. Owns `plugins/builder/dashboard/editor/**` and the `/stores/:id/builder/:page` route. S3/S4/S5 depend on its panel-host and tab contracts, so do not change them afterwards. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Visual builder: pages (Home, Product pages incl. per-product landing pages, Collection, Checkout, Success, Search), desktop/mobile preview, undo/redo, preview, publish, draft vs published
- Sections: … show/hide, reorder, actions — the list operations only (the sections themselves are P8.S3/S4)
- Builder: … keyboard shortcuts; Tassya AI design tab — shortcuts here; AI tab is a hidden extension point (P9.S7b)
- Pack products, AI image clean-up, store-page template — the store-page template part (rest is P2.S2/P9.S7b)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff `P8.S1`
- `docs/research/second-pass.md` → "Builder in detail" (top bar, tabs, list groups, keyboard shortcuts), "Builder page templates" (page switcher, "preview with product", "Customize for this product only", banner "changes here apply to N products", "Not published yet")
- `docs/research/dashboard-captures.md` → "Themes" (builder route); `docs/research/api-surface.md` (`/store-preview`)

**High-level plan**
1. Route + layout: top bar (theme name, Desktop/Mobile, page switcher, Undo, Redo, Preview, Publish), left tabs Sections / Styles / AI (AI hidden behind `builder.ai.tab` flag), resizable canvas → commit `feat(builder): editor layout and routes`
2. Canvas iframe on `/store-preview` with postMessage protocol (select section, hover, scroll-to, device width 100%/375px), preview-with-product picker → commit `feat(builder): canvas preview and device toggle`
3. Page switcher: Home, Product pages (Default, New product page, per-product via "Customize for this product only", banner "applies to N products"), Collection, Checkout, Success, Search → commit `feat(builder): page switcher and product templates`
4. Section list grouped "Shown on every page" / "Page sections" / "Footer": add-section picker (registry-driven), drag reorder, hide, delete, rename, actions menu, keyboard shortcuts (Enter, F2, Alt+↑/↓, Delete, Shift+F10) → commit `feat(builder): section list operations`
5. Settings panel host: renders a section's typed settings from the registry (generic controls + shared Appearance/Spacing/Visibility groups); hidden "Ask for changes" button (`builder.ai.askForChanges`) → commit `feat(builder): settings panel host`
6. Undo/redo history stack, autosave draft (debounced), "Not published yet" pill, Publish with confirmation, Preview in new tab, leave-page guard → commit `feat(builder): history, autosave and publish`
7. Playwright smoke test of the editor, a11y pass → commit `test(builder): editor smoke and a11y`

**Deliverables**
- Dashboard route and components, preview message protocol (documented in the handoff), page-template seeding for "store-page template".

**Acceptance criteria**
- [ ] Opening a store's builder shows the Home page in the canvas; Desktop/Mobile toggle resizes the canvas.
- [ ] Add, drag-reorder, hide, rename and delete a section; changes appear in the canvas instantly and in the draft after autosave.
- [ ] Every keyboard shortcut works (Enter opens settings, F2 renames, Alt+↑/↓ moves, Delete removes, Shift+F10 opens actions).
- [ ] Undo/redo restore any of those operations; the pill shows "Not published yet" until Publish and then clears.
- [ ] Product page shows "Default product page — changes here apply to N products"; "Customize for this product only" forks a per-product page without touching others.
- [ ] Publish updates the live store (checked via the host URL); closing without publishing keeps the live store unchanged.
- [ ] A user lacking the builder permission cannot open the editor or call the config API.

**Verification**
- Unit tests for the history stack and reorder logic; integration tests for the draft save/publish endpoints from the editor; Playwright smoke.
- Browser check against the "Builder in detail" top bar/list and "Builder page templates" switcher; screenshots (desktop, mobile preview, RTL dashboard).
- Multi-tenant: editor loaded for store A cannot save to store B (tamper the id).

**Out of scope**
- Concrete sections (P8.S3/S4), Styles tab content (P8.S5), AI behaviour (P9.S7b), landing page editor (P8.S7).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S2 "Builder editor shell" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s2-builder-shell from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S3 — Sections library A (layout & content)

| Field | Value |
|---|---|
| **Goal** | Add the layout and content sections, each with a settings panel and a storefront renderer. |
| **Branch** | `feat/p8-s3-sections-a` |
| **GitHub issue** | `P8.S3 Sections library A (layout & content)` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S2 |
| **Parallel-safe** | Yes — with P8.S4, P8.S5, P8.S7, P8.S9. Owns only new folders: `plugins/builder/src/sections/{announcement-bar,header,footer,hero-banner,image-with-text,rich-text,scrolling-banner,story,collapsible-content,follow-block,cards,collections-grid,product-grid,back-to-top,custom-html}/` and the matching `apps/storefront/src/sections/…`. Edits no shared file (registry is auto-discovered). |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Sections: announcement bar, header, footer, hero banner, image with text, rich text, scrolling banner, story, back to top, collapsible content, follow block, … cards, collections grid, product grid, … custom HTML; show/hide, reorder, actions — this session does the layout and content sections named here (before & after, reviews, offer deadline, FAQ, chat buttons, trust badges are P8.S4)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P8.S1`, `P8.S2`
- `docs/research/second-pass.md` → "Builder in detail", the "Section settings" bullets for Hero Banner, Header, Product grid, Collections, Image with Text, Footer, and "Shared section groups"
- `docs/research/dashboard-captures.md` → "Themes"; the section authoring guide in the P8.S1 handoff

**High-level plan**
1. Header, announcement bar, footer (layouts One line/Stacked/Columns, footer text, Facebook/Instagram/WhatsApp links), back to top → commit `feat(builder): header, announcement and footer sections`
2. Hero banner (carousel mode, headline, subheading, button text/link, background, layout, text alignment, vertical position, button shadow/style, height S/M/L/Full) → commit `feat(builder): hero banner section`
3. Image with text (Side by side/Overlap/Full bleed, image side, ratio, vertical align, card behind text, default button link `#in-page-checkout-block`), rich text, scrolling banner, story → commit `feat(builder): content sections`
4. Collapsible content, follow block, cards, custom HTML (sanitised/iframe-isolated) → commit `feat(builder): collapsible, follow, cards and custom html`
5. Collections grid (source, Row/Grid/List, columns, name placement, photo shape, alignment, button, stagger, zoom, count) and product grid (all/selection, 4/8/12, order, carousel, cards per breakpoint, peek, arrows, indicator, card style, View all) wired to catalog data → commit `feat(builder): collections grid and product grid`
6. Responsive/RTL review, default content seeding for each section, snapshot tests → commit `test(builder): sections a snapshots and rtl`

**Deliverables**
- 15 section folders (definition, settings panel, renderer, defaults, i18n), sample content used by default templates.

**Acceptance criteria**
- [ ] Each section can be added from the picker, edited in the panel, hidden, reordered and renders on the storefront after publish.
- [ ] Settings listed in "Builder in detail" for header, hero, product grid, collections, image with text and footer all exist, with the stated options and defaults.
- [ ] Header: logo position (start/center/above menu), phone order (icons first/menu first), height Compact/Normal/Tall, sticky hide/stay, search/cart toggles, navigation with dropdown links.
- [ ] Product grid and collections grid show real catalog data of that store only, honour selection and ordering, and respect cards per breakpoint.
- [ ] Appearance, Spacing and Visibility groups work on every section (e.g. "Mobile only" hides it on desktop).
- [ ] Custom HTML cannot access the dashboard session or other tenants' data.
- [ ] All sections render correctly in RTL and LTR.

**Verification**
- Unit tests for each settings schema/default; renderer snapshot tests; one integration test for product/collection data loading.
- Browser check against the "Section settings" bullets, desktop and mobile; screenshots per section.
- Multi-tenant: product grid on store A never lists store B products even when the selection ids are tampered.

**Out of scope**
- Product-page/conversion sections (P8.S4); styles tokens UI (P8.S5); theme presets (P8.S6).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S3 "Sections library A (layout & content)" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s3-sections-a from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S4 — Sections library B (product page & conversion)

| Field | Value |
|---|---|
| **Goal** | Add the product-page and conversion sections, including the in-page COD checkout, with settings panels and renderers. |
| **Branch** | `feat/p8-s4-sections-b` |
| **GitHub issue** | `P8.S4 Sections library B (product page & conversion)` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S2 |
| **Parallel-safe** | Yes — with P8.S3, P8.S5, P8.S7, P8.S9. Owns only new folders: `plugins/builder/src/sections/{gallery,product-info,in-page-checkout,description,reviews,faq,trust-badges,offer-deadline,chat-buttons,before-after,collection-header,success-message,search-results}/` and matching `apps/storefront/src/sections/…`. The in-page checkout reuses the P3.S3 form components (import, do not fork). |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Sections: … before & after, … reviews, offer deadline (countdown), FAQ, chat buttons (WhatsApp/Messenger/call), trust badges … — this session does these plus the page-specific sections in "Builder page templates" (gallery, product info, in-page checkout, description, collection header, success message, search results)
- COD order form on product page: full name, phone, wilaya → commune, delivery type, live delivery fee and total (cart quote), Buy it now / Add to cart / Confirm order — as the configurable In-Page Checkout section (logic stays in P3.S3)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P8.S1`, `P8.S2`, `P3.S3`
- `docs/research/second-pass.md` → "Builder page templates" ("Product-page section settings": Gallery, Product Info, In-Page Checkout (COD form), Description), "Builder in detail" (Trust Badges, Reviews, FAQ)
- `docs/research/data-model.md` → "Storefront ordering protocol" (cart-quote, shipping-quote, quoteToken)

**High-level plan**
1. Gallery (carousel mode, ratio 1:1/3:4/4:3/adapt, zoom, thumbnails count, indicator dots/bar/none, arrows circle/square/minimal) and product info (Order now + CTA text, quantity selector compact/full width + label, Add to cart style, button order, name size, badge, brand, highlights, SKU, delivery note, variant picker buttons/dropdown, pre-select first available) → commit `feat(builder): gallery and product info sections`
2. In-page checkout settings and renderer: title, submit text, form style, button animation, default delivery Desk/Home, option style buttons/list, show prices, name+phone one row, order summary, quantity in summary, per-item options, field icons, show address field, show note field, expected delivery date, sticky order button + text; uses live cart-quote/shipping-quote and the signed quote token → commit `feat(builder): in-page checkout section`
3. Description, collection header, success message, search results grid → commit `feat(builder): page-specific sections`
4. Reviews (title, carousel layout, manual sort, rating summary/dates/wilaya toggles; review items with rating, name, wilaya, text, photo or chat screenshot, date, verified badge) with image upload via media library → commit `feat(builder): reviews section`
5. FAQ (Divided/Cards, questions only/beside photo, open first), trust badges (icon, title, subtitle, Add badge), offer deadline countdown, chat buttons (WhatsApp/Messenger/call), before & after slider → commit `feat(builder): conversion sections`
6. Default templates updated (product page, checkout, success, search, collection lists from "Builder page templates"), snapshot and end-to-end order test through the section → commit `test(builder): sections b and order flow`

**Deliverables**
- 13 section folders (definition, panel, renderer, defaults, i18n); updated default page templates; review media upload endpoint reuse.

**Acceptance criteria**
- [ ] Every setting listed for Gallery, Product Info and In-Page Checkout exists with the documented options and defaults.
- [ ] A buyer completes a COD order from the in-page checkout block: wilaya → commune updates delivery fee and total live, and the order is created with the signed quote total (same result as P3.S3).
- [ ] Toggling "show address field", "note field", "expected delivery date" and "sticky order button" changes the storefront form accordingly.
- [ ] Reviews support photo and chat-screenshot items and a verified badge; FAQ and trust badges editable as lists.
- [ ] Countdown reaches zero without layout break; chat buttons open `wa.me`, Messenger and `tel:` links.
- [ ] Per-product override pages can contain these sections independently of the default product page.
- [ ] All sections work in RTL and LTR, desktop and mobile.

**Verification**
- Unit tests for settings defaults and the checkout form config mapper; renderer snapshots; integration test creating an order through the section.
- Browser check against "Product-page section settings" and the COD form flow; screenshots including sticky button on mobile.
- Multi-tenant: a quote token or order from store A's page cannot be submitted for store B.

**Out of scope**
- Layout/content sections (P8.S3); landing-page order form block (P8.S7); AI features (P9.S7b); pixel events (P9.S3).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S4 "Sections library B (product page & conversion)" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s4-sections-b from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S5 — Styles & design tokens

| Field | Value |
|---|---|
| **Goal** | Build the Styles tab: colours, typography, buttons and corners, components, layout and motion, page code, advanced mode and reset, all stored as theme tokens. |
| **Branch** | `feat/p8-s5-styles` |
| **GitHub issue** | `P8.S5 Styles & design tokens` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S2 |
| **Parallel-safe** | Yes — with P8.S3, P8.S4, P8.S7, P8.S9. Owns `plugins/builder/dashboard/styles/**`, `packages/shared/theme/tokens/**` (token extensions only, append) and `apps/storefront/src/renderer/styles/**`. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Styles: colours, typography, buttons & corners, components, layout & motion, page code (custom JS)
- Builder: … styles (palettes, Arabic font pairings, RTL/LTR, order button, global product card, filters, layout & motion, page code JS, custom CSS) — the Styles part of this row

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P8.S1`, `P8.S2`
- `docs/research/second-pass.md` → "Builder in detail" → "Styles" (Colors, Typography, Buttons & corners, Components, Layout & motion, Page code, Advanced)

**High-level plan**
1. Token schema extensions and CSS-variable generation (colours, type scale, radii, spacing, shadows, motion), deterministic ordering, tests → commit `feat(builder): style tokens and css variables`
2. Colors panel: brand, accent, canvas Light/Dark, palette generator from brand colour (harmonized) + ready-made Warm/Cool/High-contrast/Soft/Mono, advanced colours, contrast check → commit `feat(builder): colors panel`
3. Typography panel: Arabic-friendly font pairings (Cairo; Changa·Cairo; Cairo·Tajawal; Rubik·Almarai; Changa·Almarai; Tajawal·Cairo; Reem Kufi·Cairo), RTL/LTR direction, body/heading font, heading weight, body size, section title size, section label style and case; self-hosted font loading → commit `feat(builder): typography panel`
4. Buttons & corners (Solid/Outline/Soft, size, radius, secondary button, Order button size/weight, buttons on inverse sections) and Layout & motion (Tight/Balanced/Airy, content width, photo corners, shadows, motion None/Subtle/Lively) → commit `feat(builder): buttons, layout and motion panels`
5. Components panel: global product card (style, ratio, hover zoom/second photo, spacing, sizes, lift, shadow, arrow, shown elements + when), badges, fields, option buttons, collection/search filters (group style, open first, values style, swatch shape/size) → commit `feat(builder): components panel`
6. Page code (custom JS, runs only on the published store; `?nocode` disables it; sandboxed/CSP-aware), Advanced mode (custom CSS per block), reset to defaults, hidden AI hook `builder.ai.pageCode` → commit `feat(builder): page code, advanced mode and reset`
7. Live-preview wiring, snapshot tests → commit `test(builder): styles tokens and preview`

**Deliverables**
- Styles tab panels, token extensions, CSS generator, font assets, page-code injector, reset action.

**Acceptance criteria**
- [ ] Changing brand colour updates the canvas live and regenerates a harmonized palette; ready-made palettes apply in one click.
- [ ] Direction RTL/LTR and font pairings change the storefront output; Arabic text renders with the chosen font.
- [ ] Order button style (size, weight) affects the in-page checkout and product-info buttons.
- [ ] Global product card options change every product grid/collection card at once.
- [ ] Page code runs on the published store only; absent in the editor preview and when `?nocode` is present.
- [ ] Advanced mode CSS applies to the chosen block only; "Reset store to defaults" restores tokens after confirmation and is undoable until publish.
- [ ] Generated CSS is scoped to the store's host (no leakage between tenants).

**Verification**
- Unit tests for the CSS generator, palette harmonization and contrast helper; integration test for saving tokens to draft and publishing.
- Browser check against the "Styles" bullets; screenshots for each panel, RTL included.
- Multi-tenant: store A page code and CSS never appear on store B's host.

**Out of scope**
- Theme presets (P8.S6); AI "write the code for me" (P9.S7b); sections (P8.S3/S4).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S5 "Styles & design tokens" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s5-styles from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S5.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S6 — Themes: presets, apply, history

| Field | Value |
|---|---|
| **Goal** | Ship 10 of our own theme presets, the Themes page (current, mine, discover) and one-click apply/revert. |
| **Branch** | `feat/p8-s6-themes` |
| **GitHub issue** | `P8.S6 Themes: presets, apply, history` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S3, P8.S4, P8.S5 |
| **Parallel-safe** | Yes — with P8.S7, P8.S8, P8.S9. Owns `plugins/builder/themes/**` (preset packages), `plugins/builder/dashboard/themes/**` and the `/stores/:id/themes` routes. |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Themes: current theme card (history, preview, edit), my themes (try on store, apply), marketplace of 10 free themes incl. Arabic variants, theme versions

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P8.S1`–`P8.S5`
- `docs/research/dashboard-captures.md` → "Themes `/stores/:storeId/themes`" (current theme card, My themes, Discover, marketplace detail route)
- `docs/research/second-pass.md` → "Builder page templates" (default "Custom" theme section lists)

**High-level plan**
1. Theme package format (manifest: id, name, version, direction, preview images, pages JSON, tokens) and installer that copies a package into a store as a Theme with a ThemeVersion → commit `feat(builder): theme package format and installer`
2. Author 10 original presets: five designs, each in LTR and Arabic RTL variants (working names Dune, Oasis, Zellij, Atlas, Medina and their `-ar` versions), built only from P8.S3/S4/S5 sections and tokens; never copy another product's names or look → commit `feat(builder): ten theme presets`
3. Seed default theme for every new store (hook on store creation from P1.S1) and for existing stores via migration → commit `feat(builder): seed default theme for new stores`
4. Themes page: current theme card (History, Preview, Edit → builder), My themes (Try on my store, Apply), Discover (grid → detail page with previews, demo content, versions) → commit `feat(builder): themes page and marketplace`
5. Apply/try flow: apply a preset keeps content such as logo and store name, snapshots previous design, Revert to previous in one click, history list of theme versions → commit `feat(builder): apply, try and revert`
6. Tests and screenshots of all 10 presets (desktop/mobile) → commit `test(builder): presets render and revert`

**Deliverables**
- 10 preset packages with preview images, themes page, apply/revert services, default-theme seeding migration.

**Acceptance criteria**
- [ ] Discover shows exactly 10 free themes including Arabic RTL variants; each has a detail page with previews and a version.
- [ ] "Try on my store" previews without changing the live store; Apply changes the draft/live design as chosen and keeps logo, name, products.
- [ ] One click on "Revert to previous design" restores the previous theme exactly; History lists versions with dates.
- [ ] New stores start with the seeded default theme and a complete set of page templates.
- [ ] Every preset renders all page types without missing sections in both directions.
- [ ] No preset uses the Tassyir name, logo, copy or competitor theme names.

**Verification**
- Unit tests for installer/revert; snapshot render of each preset; integration test for apply/revert.
- Browser check against "Themes" notes (current theme card, My themes, Discover, detail page); screenshots of all 10.
- Multi-tenant: applying a theme in store A does not alter store B; "my themes" lists only the business's own.

**Out of scope**
- Paid themes and third-party submissions; AI design assistant (P9.S7b).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S6 "Themes: presets, apply, history" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S6), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s6-themes from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S6.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S7 — Landing pages & block editor

| Field | Value |
|---|---|
| **Goal** | Let merchants build product landing pages from blocks with a configurable order form, preview them live and serve them on the storefront. |
| **Branch** | `feat/p8-s7-landing-pages` |
| **GitHub issue** | `P8.S7 Landing pages & block editor` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S1 |
| **Parallel-safe** | Yes — with P8.S2–S6 and P8.S9. Owns `plugins/landing-pages/**`, the landing-page tabs on the product edit page (appended via the dashboard extension point from P2.S1) and `apps/storefront/src/app/lp/**` (or the agreed route). Reuses renderer APIs from P8.S1 and checkout components from P3.S3 without editing them. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Landing pages per product (plan-limited) — feature built here; the limit is enforced with `requireFeature()` and real plan data comes in P9.S1
- Landing pages: per product or chosen variants; block editor (image, text, video incl. TikTok/YouTube, button to form/WhatsApp, spacer, benefits, reviews, before/after, FAQ, countdown, trust strip, custom code); order-form block config (fields, custom questions, delivery display, summary, sticky button, language/direction, after-order thank-you/WhatsApp/link); AI generation (20 credits) — all except AI generation (P9.S7b; leave hidden "Generate with AI" and "Ask for a block" buttons at `landingPages.ai.*`)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff `P8.S1` (and `P3.S3` for the order flow)
- `docs/research/second-pass.md` → "Landing pages (performed)" (create dialog, API payload, tabs, block library, Order form block settings in full)
- `docs/research/data-model.md` → "Product" (status Active / Hidden / Draft, landing-only products) and "Storefront ordering protocol"; `docs/research/api-surface.md` → "Landing pages"

**High-level plan**
1. Entity `LandingPage` (businessId, storeId, productId, name, layout[], button, bgColor, customCss, isActive, deliveryAgentId, deliverySpeeds, defaultDeliverySpeed, offerMode, offerId, scopeVariantKeys / scopeOptionValueIds) with migration, CRUD API (`/landing-pages`), plan limit via `requireFeature()` stub → commit `feat(landing-pages): entity, api and plan gate`
2. Product edit page integration: "Add Landing Page" dialog (Whole product / Chosen variants, name), a tab per landing page with Active toggle, Settings, Preview; per-variant landing page action from variant actions → commit `feat(landing-pages): product page tabs and create dialog`
3. Block editor: Content & Layout list (Order form block required and non-deletable), Add block picker grouped Basics / Convince the buyer / Advanced, reorder, per-block settings → commit `feat(landing-pages): block editor`
4. Block library and renderers: image, text, video (MP4 muted, TikTok, YouTube embed), button (to form / WhatsApp), spacer, benefits (2–6 lines with icons), reviews, before/after, FAQ, countdown (end date or "only a few left"), trust strip, custom code (isolated) → commit `feat(landing-pages): block library`
5. Order-form block settings exactly as researched: title; fields (second phone, wilaya, commune required toggle, address required toggle, note, email, name+phone one row); custom questions; delivery display List/Tiles, default Home/Desk, show prices and arrival; product and offers display (buttons/lists, quantity); summary Open/Folded; button text/colours; sticky button + text; language AR/FR/EN and direction; after-order thank-you page / WhatsApp / link; spacing outside/inside 0–96 px with presets; per-block custom CSS → commit `feat(landing-pages): order form block`
6. Live phone preview in the editor; storefront route serving active landing pages with live quotes and orders attributed to the landing page (source) → commit `feat(storefront): landing page route and order attribution`
7. Tests: variant scoping, plan-limit denial, order creation from a landing page, tenant isolation → commit `test(landing-pages): blocks, orders and isolation`

**Deliverables**
- `plugins/landing-pages` (entity, API, dashboard editor, blocks), storefront route and block renderers, order attribution field (landing page id) on orders via existing source-attribution hook.

**Acceptance criteria**
- [ ] Creating a landing page for the whole product or chosen variants works; variant-scoped pages show/price only those variants.
- [ ] The Order form block is required and cannot be removed; every setting group listed in the research exists and changes the rendered form.
- [ ] All listed block types can be added, reordered and rendered; TikTok/YouTube/MP4 videos play; countdown ends gracefully.
- [ ] The editor shows a live phone preview that updates as settings change.
- [ ] A buyer completes a COD order from the landing page; the order records which landing page it came from; after-order action (thank-you, WhatsApp or link) works.
- [ ] Exceeding the per-product landing page limit returns a plan error (stubbed limit until P9.S1).
- [ ] An inactive landing page returns 404 on the storefront.
- [ ] AI buttons are hidden and no AI call exists.

**Verification**
- Unit tests for layout validation, variant scoping, plan gate; integration tests for CRUD and storefront order.
- Browser check of the product-edit tab, block library, order-form settings and the phone preview against "Landing pages (performed)"; screenshots.
- Multi-tenant: landing page of business A is not readable or editable with business B's token and is not served on B's host.

**Out of scope**
- A/B tests (P8.S8); AI generation (P9.S7b); real plan limits (P9.S1); pixel events (P9.S3).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S7 "Landing pages & block editor" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S7), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s7-landing-pages from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S7.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S8 — A/B tests

| Field | Value |
|---|---|
| **Goal** | Let merchants test a product page against landing pages with a sticky traffic split and a chosen winner metric. |
| **Branch** | `feat/p8-s8-ab-tests` |
| **GitHub issue** | `P8.S8 A/B tests` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P8.S7 |
| **Parallel-safe** | Yes — with P8.S6 and P8.S9. Owns `plugins/ab-tests/**`, the `/stores/:id/ab-tests` routes and one storefront proxy hook `apps/storefront/src/ab/**` called from `proxy.ts` (sticky cookie + variant rewrite; tested pages served `no-store` at the edge per ADR 0006). |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- A/B tests: landing page vs product page, lifecycle
- A/B test wizard: product → competing pages → traffic split → winner metric (conversion, AOV, confirmation rate, delivery rate)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P8.S7`, `P3.S4` (visitor ids), and `P7.S1` if merged (metric definitions in `packages/shared`; P7.S1 is not a prerequisite — if absent, define locally confirmation rate = confirmed/placed and delivery rate = delivered/finished, as P7.S1 step 1 specifies, and leave a TODO to switch)
- `docs/research/dashboard-captures.md` → "A/B Testing `/stores/:storeId/ab-tests`"; `docs/feature-inventory.md` section X (A/B test wizard)
- `docs/research/second-pass.md` → "Landing pages (performed)" for the pages that compete

**High-level plan**
1. Entities `AbTest` (status draft/running/paused/ended, product, name, winner metric, winnerVariantId), `AbVariant` (product page or landing page id, traffic %), assignment table; split validation (sums to 100, 2+ variants) → commit `feat(ab-tests): entities and validation`
2. 4-step wizard UI: pick product → pick competing pages (product page vs its landing pages) → traffic split sliders → winner metric (conversion, AOV, confirmation rate, delivery rate) + test name → commit `feat(ab-tests): creation wizard`
3. Storefront assignment: deterministic sticky split by visitor id cookie (from P3.S4), rendering the assigned page on the product URL with no flicker and no cache poisoning (vary by assignment), bot exclusion → commit `feat(storefront): sticky traffic split`
4. Metrics aggregation per variant from visitors and orders (visitors, orders, conversion, AOV, confirmation rate, delivery rate via order events; reuse P7.S1 definitions), with sample-size note → commit `feat(ab-tests): metrics aggregation`
5. Lifecycle actions start / pause / end / declare winner (winner receives 100% and the test ends) and list page with status and leading variant → commit `feat(ab-tests): lifecycle and list page`
6. Tests incl. split distribution, stickiness, isolation → commit `test(ab-tests): split, metrics and isolation`

**Deliverables**
- `plugins/ab-tests` (entities, API, jobs, dashboard wizard/list/detail), storefront assignment hook, metric job.

**Acceptance criteria**
- [ ] The wizard rejects a split that does not total 100% and tests with fewer than two pages.
- [ ] Over 10,000 simulated visitors the split is within ±2 points of the configured percentages; the same visitor always gets the same variant, including after reload.
- [ ] Orders placed on a variant are attributed to it; per-variant visitors, conversion, AOV, confirmation rate and delivery rate are shown and match fixtures.
- [ ] Pause stops assignment (everyone sees the default page); End/Declare winner sends 100% to the winner.
- [ ] Only one running test per product.
- [ ] The test list shows status, product, winner metric and the leading variant.

**Verification**
- Unit tests for the splitter (hash distribution), metrics and lifecycle state machine; integration tests for the API and storefront assignment.
- Browser check of the wizard and list against the "A/B Testing" note; storefront checked in two browser profiles.
- Multi-tenant: tests, assignments and metrics of business A are invisible to B; a visitor id from store A does not affect store B.

**Out of scope**
- Statistical significance engine beyond a basic note; testing non-product pages; AI insights (P9.S7b).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S8 "A/B tests" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S8), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s8-ab-tests from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S8.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P8.S9 — Subdomains & custom domains

| Field | Value |
|---|---|
| **Goal** | Let merchants change their free subdomain and connect, verify and promote custom domains, with host routing and automatic TLS through Cloudflare for SaaS. |
| **Branch** | `feat/p8-s9-domains` |
| **GitHub issue** | `P8.S9 Subdomains & custom domains` (label `phase-8`, milestone `P8 Builder & themes`) |
| **Prerequisites** | P3.S2, P3.S5 |
| **Parallel-safe** | Yes — with all P8 sessions. Owns `plugins/domains/**`, the store-settings "Domains" tab, the `apps/storefront` host-resolution module used by `proxy.ts` (`src/host/**`), and deploy/cloudflare/** (custom-hostname client + docs). |
| **Model / size** | Opus · M |
| **External needs** | 🔑 The staging environment from P3.S5 and a Cloudflare API token scoped to custom hostnames on the staging zone. Until provided: `*.localhost` plus a manual-verification stub that marks a domain verified from a dev-only endpoint, and the mocked Cloudflare client. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Free subdomain (availability check, change)
- Custom domains: connect, DNS instructions, verify, make primary, enable/disable
- Custom domain inline connect → DNS records → verify

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P3.S2` (host resolution), `P1.S1` (stores and hosts)
- `docs/research/dashboard-captures.md` → "Store settings `/stores/:storeId/store_settings`" → Domains (`/domains?storeId`, subdomain Change, Connect domain)
- `docs/research/second-pass.md` → "Onboarding" (live "is available" subdomain check); `docs/feature-inventory.md` section X (Custom domain inline connect)
- ADRs on multi-tenancy and host routing in `docs/adr/`: 0002, 0006 (host map), 0012 (edge, TLS, custom domains); handoff `P3.S5` (Cloudflare modules, staging zone); `docs/architecture/system-design.md` §3 (edge), `infrastructure.md` §2

**High-level plan**
1. Domain strategy: host → store resolution cache, reserved subdomains list, verification method (TXT record at `_verify.<domain>` plus CNAME/A target), Cloudflare for SaaS custom hostnames per ADR 0012 (CNAME to stores.<root>, Cloudflare DCV + our _verify TXT ownership check, apex via CNAME flattening/ALIAS or registrar forwarding to www); record the decision as an addendum to ADR 0012 rather than a new ADR → commit `docs(adr): 0012 addendum custom domain strategy`
2. `Domain` entity (businessId, storeId, host, kind subdomain/custom, status pending/verified/failed, primary, enabled, verificationToken) and APIs: subdomain availability check + change (format, length, reserved, uniqueness, old subdomain redirects for a grace period), connect, remove → commit `feat(domains): entities and subdomain api`
3. Verification: DNS instructions generator (apex vs `shop.` subdomain case), domains-queue job polling the Cloudflare custom hostname status and our TXT record, retry schedule, manual "Verify now", failure reasons → commit `feat(domains): dns verification job`
4. Domains tab UI: subdomain Change dialog with live availability; Connect domain inline (mystore.com or shop.mystore.com) → DNS records table with copy → status and Verify → Make primary → enable/disable → commit `feat(domains): domains tab ui`
5. Storefront host routing: resolve custom and sub-domains to a store through the P1.S1 host map (Valkey `host:{host}` + pub/sub invalidation), non-primary hosts redirect (301) to the primary, disabled/unverified hosts 404; purge the edge cache by hostname on change → commit `feat(storefront): custom domain host routing`
6. Cloudflare client (create/delete custom hostname, read status, purge by hostname) behind an interface with a mock; staging run: connect a real test domain end to end; runbook deploy/cloudflare/README.md → commit `feat(domains): cloudflare for saas integration`
7. Tests incl. isolation and custom-hostname abuse cases (unverified, disabled, already owned by another business) → commit `test(domains): verification, routing and cloudflare client`

**Deliverables**
- `plugins/domains`, host-resolution module, Cloudflare custom-hostname client (+ mock) and `deploy/cloudflare/README.md`, dashboard Domains tab, ADR 0012 addendum, staging verification notes in the handoff.

**Acceptance criteria**
- [ ] Changing the subdomain checks availability live, rejects reserved/taken/invalid names, and the storefront answers on the new host immediately.
- [ ] Connecting `mystore.com` or `shop.mystore.com` shows the right DNS records for each case; Verify turns the status to verified only when the records resolve (checked against a DNS mock in tests).
- [ ] Make primary redirects other hosts to it; disable makes the host return 404; re-enable restores it.
- [ ] A custom hostname is created at Cloudflare only after the domain passes our ownership TXT check; disabling a domain removes routing immediately and deletes the Cloudflare hostname after 7 days.
- [ ] A domain already attached to another business cannot be connected (clear error, no leak of who owns it).
- [ ] On the P3.S5 staging zone (when the token is available) a verified custom domain is served over HTTPS with a Cloudflare-issued certificate; result documented with evidence.
- [ ] Without the staging domain, the `*.localhost` flow and the manual verification stub pass.

**Verification**
- Unit tests for validators, DNS instruction generator, verification logic; integration tests for APIs, host routing and the Cloudflare client (against its mock).
- Browser check of the Domains tab against the "Domains" capture and the inline connect flow; curl/browser check of redirects and TLS on staging.
- Multi-tenant: business B cannot list, verify, delete or hijack business A's domains; host routing never serves store A for B's host.

**Out of scope**
- Domain purchase/registrar integration; email hosting; production zone, fallback origin and custom-hostname setup (P10.S3); staging infrastructure itself (P3.S5).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P8.S9 "Subdomains & custom domains" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P8-builder-themes.md (section P8.S9), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p8-s9-domains from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P8.S9.md` → commit → push → `gh pr create` → report PR link → stop.
