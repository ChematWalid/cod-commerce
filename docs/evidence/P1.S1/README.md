# Evidence for P1.S1 (tenancy)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S1.sh`. Data is synthetic
(demo seed, placeholders from `.env.example`). Image built from a tree with no uncommitted change outside the evidence
folders, last image-relevant commit `4886c38e29da1a17d51a73550f232b970bfcb23a`. Compose project `cod-evidence`, with a second api container on port 23101.
The demo seed ran twice; the second run created nothing.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/provision.md`](api/provision.md) | `provisionBusiness` |
| [`api/business.md`](api/business.md) | `activeBusiness`, `business`, `updateBusiness` |
| [`api/stores.md`](api/stores.md) | `stores`, `store`, `createStore` (also taken), `updateStore`, `archiveStore` and the archived host's 404 |
| [`api/availability.md`](api/availability.md) | Anonymous availability: available, taken (also an archived store's), reserved, invalid; REST and GraphQL |
| [`api/resolve.md`](api/resolve.md) | `GET /store/resolve` and `GET /store/by-id/:id`, including 404s |
| [`api/isolation.md`](api/isolation.md) | Cross-tenant not-found: A's owner on B's ids |
| [`api/forbidden.md`](api/forbidden.md) | FORBIDDEN: B's channel token, `channels`, `provisionBusiness`, anonymous, superadmin without a tenant |
| [`api/subdomain-change.md`](api/subdomain-change.md) | `changeStoreSubdomain`: both api processes drop the old host and serve the new one within 1000 ms |

Ids and channel tokens are replaced by placeholders after every assertion ran on the real values. Session tokens, cookies and
passwords are redacted.

## Screenshots

Storefront:

| File | URL | Viewport | Status | Asserted |
| --- | --- | --- | --- | --- |
| [`demo-desktop.png`](screens/demo-desktop.png) | `http://demo.localhost:23001/` | desktop 1280x800, scale 1 | 200 | Demo Store (store locale `ar`): `store-name` visible with `Demo Store`; `Second Store` absent |
| [`demo-mobile.png`](screens/demo-mobile.png) | `http://demo.localhost:23001/` | mobile 390x844, touch, scale 2 | 200 | Demo Store (store locale `ar`): `store-name` visible with `Demo Store`; `Second Store` absent |
| [`second-desktop.png`](screens/second-desktop.png) | `http://second.localhost:23001/` | desktop 1280x800, scale 1 | 200 | Second Store (store locale `fr`): `store-name` visible with `Second Store`; `Demo Store` absent |
| [`second-mobile.png`](screens/second-mobile.png) | `http://second.localhost:23001/` | mobile 390x844, touch, scale 2 | 200 | Second Store (store locale `fr`): `store-name` visible with `Second Store`; `Demo Store` absent |
| [`not-found-desktop.png`](screens/not-found-desktop.png) | `http://nope.localhost:23001/` | desktop 1280x800, scale 1 | 404 | the not-found page (unknown host): `not-found` visible with `Page not found`; `Demo Store`, `Second Store` absent |
| [`not-found-mobile.png`](screens/not-found-mobile.png) | `http://nope.localhost:23001/` | mobile 390x844, touch, scale 2 | 404 | the not-found page (unknown host): `not-found` visible with `Page not found`; `Demo Store`, `Second Store` absent |

Dashboard, signed in as the demo owner on the Arabic store:

| File | URL | Viewport | Language | `dir` / `lang` asserted |
| --- | --- | --- | --- | --- |
| [`template-notes-ar-desktop.png`](screens/template-notes-ar-desktop.png) | `/dashboard/template-notes` | desktop 1280x800, scale 1 | ar | `rtl` / `ar` |
| [`template-notes-en-desktop.png`](screens/template-notes-en-desktop.png) | `/dashboard/template-notes` | desktop 1280x800, scale 1 | en | `ltr` / `en` |
| [`template-notes-ar-mobile.png`](screens/template-notes-ar-mobile.png) | `/dashboard/template-notes` | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar` |
| [`template-notes-en-mobile.png`](screens/template-notes-en-mobile.png) | `/dashboard/template-notes` | mobile 390x844, touch, scale 2 | en | `ltr` / `en` |
| [`dashboard-content-language-ar-desktop.png`](screens/dashboard-content-language-ar-desktop.png) | `/dashboard/template-notes`, channel switcher open | desktop 1280x800 | ar | content language asserted `ar` |

## What was seen in each screenshot (opened by eye, CLAUDE.md §3a.17)

| File | Seen |
| --- | --- |
| `demo-desktop.png`, `demo-mobile.png` | "Demo Store" centred on a plain page. The store name is the seed's English name on an Arabic store, which is data, not an untranslated string. No third-party name. Layout intact. |
| `second-desktop.png`, `second-mobile.png` | "Second Store" centred, in a different font from the Arabic store (the French store's Latin face). No third-party name. Layout intact. |
| `not-found-desktop.png`, `not-found-mobile.png` | The not-found message in Arabic, French and English, centred. No third-party name. |
| `template-notes-ar-desktop.png` | Owner "Demo Owner", sidebar on the right, page title "الملاحظات", menu and breadcrumb in Arabic, both notes listed, RTL alignment correct. The sidebar shows "اللغة: العربية". **Flag:** the store switcher shows the channel code, a truncated hex string, instead of the store name. |
| `template-notes-ar-mobile.png` | Arabic title, both notes, right-aligned; sidebar collapsed. No broken layout. |
| `template-notes-en-desktop.png` | English chrome ("Notes", "Catalog", "Insights"), sidebar on the left, left-aligned, "Language: Arabic" (the store's content language, with the display language English). Same hex-code flag. |
| `template-notes-en-mobile.png` | English title, both notes, left-aligned. No broken layout. |
| `dashboard-content-language-ar-desktop.png` | Switcher open in Arabic: content language row reads "المحتوى: العربية", which is the D7 result. **Flags:** three channels listed by hex code, cut off at the menu's left edge; the third is the store archived earlier in this run, so an archived store stays in the owner's switcher. |

No error, alert or toast on any dashboard shot. No third-party name on any of these shots. The dashboard's login page, which carries the licence-required footer (ADR 0001), is not among them. The notes bodies "evidence" are the synthetic data of the script, not an untranslated UI string.

The hex channel code and the archived store in the switcher are deferred to P1.S5, which owns the switcher.

Outside the shots, on a host-run api with the same owner: the landing page (Insights, an empty widget message in Arabic) and the merchant shell render with no alert or toast. The only refused query after sign-in is the dashboard's own `channels` (A1), which falls back to the owner's channels from `me`.
