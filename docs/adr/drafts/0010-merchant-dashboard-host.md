# ADR-0010: Merchant dashboard host

**Date**: 2026-11-07
**Status**: Proposed (draft for P0.S2a; spike A answers (b)–(e) before acceptance)
**Deciders**: architect (draft), user

## Context

- The React `@vendure/dashboard` replaced the Angular Admin UI in v3.5. The Angular UI gets only critical fixes until July 2026, so it is effectively end-of-life now [VN §7].
- Extensions via `defineDashboardExtension`: routes, pageBlocks, navSections (function form since 3.6, so built-in sections can be reorganised or replaced), actionBarItems, widgets, login, toolbarItems… i18n is Lingui. `useDisplayLocale()` exposes `isRTL`, but Arabic RTL completeness is UNVERIFIED [VN §7].
- The dashboard is built with Vite by scanning VendureConfig, so all plugin dashboard code compiles into one build. It is served by `DashboardPlugin` or hosted as a static site [VN §7].
- Spike A questions: (a) unauthenticated routes (register, forgot password); (b) hide or replace the built-in nav for merchants; (c) RTL + Arabic font; (d) business/store switcher in the top bar; (e) is the extension API stable?

## Options

1. **Vendure React dashboard + our extensions (recommended, conditional)**: we get product, variant, collection, stock, roles and administrator screens, auth and the permission-aware nav for free. Our COD screens are extension routes in `plugins/<name>/dashboard/`.
2. **Our own Next.js admin app (`apps/admin`) on the Admin API + plugin APIs**, with the Vendure dashboard kept for platform staff: full UX control and one React stack with the storefront. But we rebuild catalog, stock and roles screens (est. +4–6 person-weeks [BK estimate]) and two admin UIs drift.
3. **Angular Admin UI**: end-of-life. Rejected.

## Decision

**Option 1**, with these structural choices that take question (a) off the critical path:

- **Unauthenticated flows are not in the dashboard.** Sign-up wizard, forgot/reset password, email verification and invitation acceptance live in the Next.js app on `ourdomain` under `/(platform)/*` (ADR 0006). They call public auth endpoints on the API and finish by redirecting to `app.ourdomain/login`. No token handoff between origins.
- **Hosting**: `DashboardPlugin` serves the built dashboard from the API containers at `app.ourdomain/`. The Admin API is same-origin at `app.ourdomain/admin-api`. Dashboard and API versions are deployed atomically in one image (ADR 0013), so the schema and the UI never skew. Cloudflare caches the hashed assets.
- **Merchant nav**: the `navSections` function form replaces the built-in sections with our IA (Home, Orders, Tracking, Products, Customers, Inventory, Finance, Analytics, Store, Apps, Settings). Built-in pages stay reachable where reused (products, variants, collections) under our sections. Platform staff see the full built-in nav, by permission.
- **Business/store switcher**: a `toolbarItems` extension that sets the active channel. The business is implied by the user.
- **RTL**: Lingui `ar` catalogue, `dir="rtl"` from `useDisplayLocale().isRTL`, IBM Plex Sans Arabic font, logical CSS properties. RTL is verified on every reused built-in page we expose.
- **Builder editor (P8.S2)** is a full-screen extension route hosting Puck with the storefront preview iframe (ADR 0006).
- **Path convention**: `plugins/<name>/dashboard/index.tsx` (extension entry), `plugins/<name>/dashboard/routes/*`, `plugins/<name>/dashboard/i18n/{en,ar}.po`.

**Fallback rule (decided now, applied by spike result)**: if spike A shows (b) the built-in nav cannot be replaced for merchant roles, or (c) RTL is broken in built-in pages we must reuse and cannot be fixed with CSS overrides, or (e) the extension API is not marked stable in 3.8, then choose **Option 2**. In that case: `apps/admin` (Next.js 16, same design tokens as the storefront), path mapping `plugins/<name>/dashboard/` → `apps/admin/src/features/<name>/`, Vendure dashboard for platform staff only. The handoff records the mapping for all later briefs.

## Consequences

### Positive
- Weeks of catalog, stock and RBAC UI reused. One auth and permission model. Atomic UI/API deploys.

### Negative
- We depend on the extension API's evolution: dashboard extension breaking changes become an M.S1 checklist item.
- The merchant UX is bounded by what the dashboard shell allows (mitigated by full-screen custom routes).

### Risks
- **Arabic RTL gaps in built-in components.** Mitigation: spike A screenshots; CSS overrides in our extension; upstream issues filed.
- **Licence of the compiled dashboard bundle** (GPLv3 `@vendure/dashboard` + our extensions, conveyed to browsers): open question for counsel in ADR 0001 §8. A "must be GPL" answer is an additional trigger for Option 2.
