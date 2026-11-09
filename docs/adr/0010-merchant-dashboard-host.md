# ADR-0010: Merchant dashboard host

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-1/P0.S2a-2 review
**Deciders**: architect (draft), user

## Context

- The React `@vendure/dashboard` replaced the Angular Admin UI in v3.5. The Angular UI gets only critical fixes until July 2026, so it is effectively end-of-life now [VN §7].
- Extensions via `defineDashboardExtension`: routes, pageBlocks, navSections (function form since 3.6; per-user `isVisible` predicates and the `setNavVisibility` / `keepOnlyNavEntries` helpers since 3.8), actionBarItems, insights widgets, login, toolbarItems (since 3.5.3), customProviders (since 3.7)… i18n is Lingui. `useDisplayLocale()` exposes `isRTL`, and the app sets `html[dir]` from it.
- The dashboard is built with Vite by scanning VendureConfig, so all plugin dashboard code compiles into one build. It is served by `DashboardPlugin` or hosted as a static site [VN §7].
- Spike A questions: (a) unauthenticated routes (register, forgot password); (b) hide or replace the built-in nav for merchants; (c) RTL + Arabic font; (d) business/store switcher in the top bar; (e) is the extension API stable? Results are in Evidence below.

## Options

1. **Vendure React dashboard + our extensions**: we get product, variant, collection, stock, roles and administrator screens, auth and the permission-aware nav for free. Our COD screens are extension routes in `plugins/<name>/dashboard/`.
2. **Our own Next.js admin app (`apps/admin`) on the Admin API + plugin APIs**, with the Vendure dashboard kept for platform staff: full UX control and one React stack with the storefront. But we rebuild catalog, stock and roles screens (est. +4–6 person-weeks [BK estimate]) and two admin UIs drift.
3. **Angular Admin UI**: end-of-life. Rejected.

## Decision

**Option 1.** The fallback rule (below) was applied to the spike A evidence and none of its triggers fired: (b) passed, (c) has only CSS-fixable layout defects plus translation gaps (not RTL breakage), (e) has positive stability evidence (see Evidence (e) for the exact wording and its limits).

Structural choices:

- **Unauthenticated flows are not in the dashboard.** Sign-up wizard, forgot/reset password, email verification and invitation acceptance live in the Next.js app on `ourdomain` under `/(platform)/*` (ADR 0006). They call public auth endpoints on the API and finish by redirecting to `app.ourdomain/login`. No token handoff between origins. Spike A showed that `authenticated: false` extension routes work, so a dashboard-side page (e.g. an invitation landing) stays possible, but it is not the plan.
- **Hosting**: `DashboardPlugin` serves the built dashboard from the API containers at `app.ourdomain/`. The Admin API is same-origin at `app.ourdomain/admin-api`. Dashboard and API versions are deployed atomically in one image (ADR 0013), so the schema and the UI never skew. Cloudflare caches the hashed assets.
- **Merchant nav**: the `navSections` function form appends our IA (Home, Orders, Tracking, Products, Customers, Inventory, Finance, Analytics, Store, Apps, Settings) with `isVisible: isMerchant` and hides every built-in section for merchants with `setNavVisibility(config, { sections: Object.values(BUILT_IN_NAV_SECTION_IDS) }, ctx => !isMerchant(ctx))`. `isMerchant(ctx) = !!ctx.administrator && !ctx.hasPermissions(['PlatformStaff'])`. Built-in pages stay reachable where reused (products, variants, collections) as items of our sections pointing at the built-in URLs. Platform staff (the `PlatformStaff` custom permission) see the full built-in nav. Nav visibility is presentation only: authorization stays on the Admin API (ADR 0008).
- **Business/store switcher**: a `toolbarItems` extension using `useChannel().setActiveChannel(id)`. The business is implied by the user.
- **RTL**: Lingui `ar` catalogue (bundled), `dir="rtl"` set by the dashboard from `useDisplayLocale().isRTL`, IBM Plex Sans Arabic font, logical CSS properties. One shared RTL stylesheet in our extension carries the overrides listed in Evidence (c). RTL is verified on every reused built-in page we expose; missing `ar` strings in built-in pages are fixed by an upstream contribution to the dashboard's `ar.po`.
- **Builder editor (P8.S2)** is a full-screen extension route hosting Puck with the storefront preview iframe (ADR 0006).

### Path convention (later briefs use this)

| What | Path |
|---|---|
| Extension entry (`defineDashboardExtension`), referenced by the plugin's `dashboard: './dashboard/index.tsx'` | `plugins/<name>/dashboard/index.tsx` |
| Extension routes (pages) | `plugins/<name>/dashboard/routes/*` |
| Extension components (toolbar items, page blocks, widgets) | `plugins/<name>/dashboard/components/*` |
| Extension translations | `plugins/<name>/dashboard/i18n/{en,ar}.po` |
| Merchant IA, RTL stylesheet, store switcher (one owner plugin) | `plugins/merchant-shell/dashboard/…` (owner session: the first session that builds merchant UI) |
| Custom permissions such as `PlatformStaff` | `PermissionDefinition` in the owning plugin's server code, pushed to `authOptions.customPermissions` in its `configuration` |

**Fallback rule (decided in the draft, applied above)**: if spike A shows (b) the built-in nav cannot be replaced for merchant roles, or (c) RTL is broken in built-in pages we must reuse and cannot be fixed with CSS overrides, or (e) the extension API is not marked stable in 3.8, then choose **Option 2**: `apps/admin` (Next.js 16, same design tokens as the storefront), path mapping `plugins/<name>/dashboard/` → `apps/admin/src/features/<name>/`, Vendure dashboard for platform staff only. Not triggered; kept here so a later re-evaluation (e.g. at an M.S1 upgrade that breaks the extension API) applies the same mapping.

## Consequences

### Positive
- Weeks of catalog, stock and RBAC UI reused. One auth and permission model. Atomic UI/API deploys.
- The 3.8 nav API (`isVisible` with `DashboardUserContext`) gives per-user nav without hacks.

### Negative
- We depend on the extension API's evolution: dashboard extension breaking changes become an M.S1 checklist item (re-run spike A checks a–d against the new version).
- The merchant UX is bounded by what the dashboard shell allows (mitigated by full-screen custom routes). Built-in breadcrumbs keep built-in section names (a merchant on the product list sees "Catalog > Products").
- Built-in pages remain reachable by URL for merchants; only the Admin API permissions protect them (by design, ADR 0008).

### Risks
- **Arabic gaps in built-in components** (Evidence (c)): a few untranslated strings and unmirrored icons. Mitigation: our RTL stylesheet, an upstream `ar.po` PR, the RTL check on every reused page.
- **`PlatformStaff` is checked on the active channel** (`hasPermissions` is channel-scoped). SuperAdmin holds it everywhere because 3.8 auto-assigns new channels to the SuperAdmin role; a non-superadmin staff role needs the permission on every channel, or the predicate must check `ctx.roles` instead. P10.S2 decides.
- **Licence of the compiled dashboard bundle** (GPLv3 `@vendure/dashboard` + our extensions, conveyed to browsers): open question for counsel in ADR 0001 §8. A "must be GPL" answer is an additional trigger for Option 2.
- **Stability evidence is product-level, not a written extension-API guarantee** (Evidence (e)). If the user reads the fallback rule strictly, (e) becomes "unclear" and Option 2 applies; the reviewer decides in the PR.

## Evidence

Spike A, 2026-11-07, scratch app outside the repo (`%TEMP%\p0s2a\spike`, never committed).

**Versions and boot**
- Windows 11, Node `v24.22.1`, npm `11.14.1`. `@vendure/core`, `@vendure/dashboard`, `@vendure/cli` `3.8.1`; Vite `7.3.7`.
- Scaffold: `npx @vendure/create@3.8.1 spike --ci --db sqlite` (React dashboard, sample data: 54 products).
- Boot: `npm run dev` (`vendure dev all`) → log: `Vendure server (v3.8.1) now running on port 3000`, `Dashboard UI: http://localhost:3000/dashboard`, Vite dashboard dev server `http://localhost:5173/dashboard`, `Found 1 Dashboard extensions`.
- **Deviation (SQLite, not Postgres):** Docker was not available, so the spike ran on the scaffold's SQLite instead of the compose Postgres in the plan. Nothing in a–e depends on the database. One `createAdministrator` call failed once with `SqliteError: database is locked` (server and worker share the file) and succeeded on retry; not relevant on Postgres.
- Note: the 3.8.1 scaffold already writes `authOptions.tokenMethod: ['bearer', 'cookie']`; the spike set `['cookie', 'bearer']` as ADR 0008 specifies.

**Spike code** (scratch plugin `src/plugins/spike-a/`): `spike-a.plugin.ts` declares `new PermissionDefinition({ name: 'PlatformStaff' })`, pushes it to `config.authOptions.customPermissions`, and sets `dashboard: './dashboard/index.tsx'`. `dashboard/index.tsx` calls `defineDashboardExtension({ routes, navSections, toolbarItems })` as described in Decision.

**Test data** (Admin API `http://localhost:3000/admin-api`, superadmin bearer token): `createChannel(code: "store-b", …)` → id 2; `assignProductsToChannel(channelId: "2", productIds: ["4","5","6"])`; `createRole(code: "merchant", channelIds: ["2"], permissions: [ReadCatalog, ReadProduct, ReadOrder])` → id 6; `createAdministrator(… roleIds: ["6"])` (local test account). `me { channels { code permissions } }` for superadmin: `PlatformStaff` present on `__default_channel__` and `store-b` (99 permissions each).

**(a) Unauthenticated route — PASS.** `{ path: '/register', authenticated: false }` loads at `http://localhost:5173/dashboard/register` after clearing cookies and `localStorage`; no redirect to `/login`, page rendered without the app shell. → [a-public-route.png](assets/0010/a-public-route.png)

**(b) Replace the nav for merchants — PASS.** Logged in as the merchant: sidebar = Home, Orders, Tracking, Products (All products, Collections), Customers, Inventory, Finance, Analytics, Store, Apps, Settings; no built-in section. "Products → All products" opens the built-in product list (`/products`, 3 products of store-b). Superadmin: full built-in nav (Insights, Catalog, Sales, Customers, Marketing, Settings, System) and none of ours. The current user's permissions **are** readable: in 3.8 the function form attaches `isVisible(ctx: DashboardUserContext)` predicates, evaluated on every nav render, with `ctx.hasPermissions([...])` (active channel, OR semantics), `ctx.roles`, `ctx.isSuperAdmin`, `ctx.administrator.customFields`. The navSections function itself runs once at registration, so the per-user logic must live in the predicates. → [b-merchant-nav.png](assets/0010/b-merchant-nav.png), [b-superadmin-nav.png](assets/0010/b-superadmin-nav.png)

**(c) RTL + Arabic font — PARTIAL (no fallback trigger).** Display language set to Arabic via user menu → Language → Arabic (setting `localStorage` directly is overwritten by the server-stored user settings). Result: `document.documentElement.dir === 'rtl'`, sidebar moves to the right (`data-side="right"`), built-in strings in Arabic (`المنتجات`). IBM Plex Sans Arabic loaded from Google Fonts by a `<link>` + `<style>` injected in the extension entry: computed `font-family` `"IBM Plex Sans Arabic", …`, `document.fonts.check(...)` true. Broken elements on Products list and Product detail:

| Element | Problem | CSS override fixes it? |
|---|---|---|
| Breadcrumb separators, table row chevrons, pagination prev/next | `lucide-chevron-right/left` without an `rtl:` variant, not mirrored | **Yes**: `html[dir=rtl] svg.lucide-chevron-right:not([class*="rtl:"]), … chevron-left… { scale: -1 1 }` (verified: computed `scale: -1 1`) |
| Sidebar section chevrons | `rtl:rotate-180` overrides the open-state `rotate-90`, so open/closed look the same | Yes (not applied in the spike): a more specific rule for `[data-open] svg` |
| Product description (rich-text editor), stock "0 / 100", other mixed LTR cells | Bidi reordering of LTR content (trailing period jumps to the start; "100 / 0" shows reversed) | **Yes**: `unicode-bidi: plaintext` on `.ProseMirror p`, `td`, `input` (verified in [c-rtl-detail-css-fixed.png](assets/0010/c-rtl-detail-css-fixed.png)) |
| Prices `US$ 130.00` | Shown as `$US 130.00` (Intl output starts with RLM) | Partly; cosmetic, use DZD formatting from ADR 0005 |
| Facet chips | Truncated on the wrong side (`...ategory`) | Yes with `direction`/`text-overflow` on the chip; not applied |
| "Administration" sidebar group, "of" in pagination ("1–1 of 1"), "Toggle Sidebar" label | Missing in the bundled `ar` catalogue | **No** (translation, not CSS): upstream `ar.po` PR |
| `html[lang]` | Stays `en` in Arabic | No CSS; one line in our extension (`document.documentElement.lang`) |
| Our own store switcher | Label bidi-garbled (`__Store: __default_channel`) | Ours: `unicode-bidi: plaintext` + translated labels |

→ [c-rtl-list.png](assets/0010/c-rtl-list.png), [c-rtl-detail.png](assets/0010/c-rtl-detail.png) (before overrides), [c-rtl-detail-css-fixed.png](assets/0010/c-rtl-detail-css-fixed.png) (after)

**(d) Store switcher in the toolbar — PASS.** `toolbarItems: [{ id: 'spike-store-switcher', component: StoreSwitcher }]`, a `<select>` over `useChannel().channels` calling `setActiveChannel(id)`. As superadmin on `/products`: before 54 products (default channel), after selecting store-b 3 products; `localStorage['vendure-selected-channel-token'] = 'store-b-token'`, the sidebar channel header changed to store-b, and requests carried `vendure-token: store-b-token`. → [d-switcher.png](assets/0010/d-switcher.png)

**(e) Extension API stability — PASS (product-level evidence; see Risks).**
- Release note v3.5.0, published 2025-10-22, heading "Dashboard Stable Release": https://github.com/vendurehq/vendure/releases/tag/v3.5.0
- Versioning policy (docs v3.8.0): Vendure follows SemVer, breaking API changes only in major versions, exceptions listed in the changelog: https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/guides/developer-guide/updating/index.mdx
- Dashboard "Public API & Imports" guide (v3.8.0): importing from `@vendure/dashboard` "keeps your extensions stable across Dashboard upgrades": https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/guides/extending-the-dashboard/public-api/index.mdx
- Source of `@vendure/dashboard@3.8.1`: no `@experimental`/`@beta` tags in `framework/extension-api`, `nav-menu`, `toolbar`; deprecated members are kept until the next major (`widgets`: "will be removed in the next major version").
- Limit: no page says in so many words "the extension API is stable"; the evidence is the Dashboard's stable release plus the project-wide SemVer policy.

**ADR 0008 input (token).** With `tokenMethod: ['cookie', 'bearer']`, 20 of the 21 Admin API requests captured around login carried `Authorization: Bearer <token>` (the one without was sent before a session existed), and every request after a reload did, the token was stored in `localStorage['vendure-session-token']`, and the `session`/`session.sig` HttpOnly cookies were sent as well. With `tokenMethod: 'cookie'` the dashboard logged in and listed products with no `Authorization` header and no token in `localStorage`.

## Addendum (2026-11-09): P1.S2 decision D20

**Status**: Accepted (2026-11-09, standing user authorization for P1)

**D20 reverses the first structural choice above.** The sign-up wizard, email verification and email-change confirmation are dashboard routes with `authenticated: false` (`/register`, `/verify-email`, `/confirm-email-change`), added by `plugins/auth/dashboard`. Forgot and reset password stay the dashboard's stock `/forgot-password` and `/reset-password`, which a plugin cannot replace. They are not Next.js `/(platform)/*` pages and do not redirect to `app.ourdomain/login`.

Why: the P1.S2 acceptance needs the merchant to land on Home right after submitting the wizard. The "no token handoff between origins" rule stays intact because the wizard runs on the dashboard origin: `auth.login` there stores the session and the owner (who holds only the new store's channel) lands on the new store. Spike A already proved that `authenticated: false` routes load without the app shell. Invitation acceptance (P1.S3) is not decided here.

Cost if wrong: move three pages to Next.js and accept a login step after sign-up.
