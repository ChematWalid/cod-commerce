# Evidence for P1.S1 (tenancy)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S1.sh`. Data is synthetic
(demo seed, placeholders from `.env.example`). Image built from a tree with no uncommitted change outside the evidence
folders, last image-relevant commit `f32bd2ae76915919ff1720bf44f3622e6d1bf66b`. Compose project `cod-evidence`, with a second api container on port 23101.
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
| [`dashboard-content-language-ar-desktop.png`](screens/dashboard-content-language-ar-desktop.png) | `/dashboard/template-notes`, store switcher open, store `demo` active | desktop 1280x800, scale 1 | ar | `rtl` / `ar`, content language `ar` (D7) |
| [`dashboard-content-language-ar-mobile.png`](screens/dashboard-content-language-ar-mobile.png) | `/dashboard/template-notes`, store switcher open, store `demo` active | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar`, content language `ar` (D7) |

## What was seen in each screenshot (opened by eye, CLAUDE.md §3a.17)

Re-checked on 2026-11-13 after the #225 fix (the store is now chosen through the merchant store switcher in the top bar).

| File | Seen |
| --- | --- |
| `demo-desktop.png`, `demo-mobile.png` | "Demo Store" centred on a plain page. The store name is the seed's English name on an Arabic store, which is data, not an untranslated string. No third-party name. Layout intact. |
| `second-desktop.png`, `second-mobile.png` | "Second Store" centred, in a different font from the Arabic store (the French store's Latin face). No third-party name. Layout intact. |
| `not-found-desktop.png`, `not-found-mobile.png` | The not-found message in Arabic, French and English, centred. No third-party name. |
| `template-notes-ar-desktop.png` | Merchant shell in Arabic: sidebar on the right, top bar with the store switcher reading "Demo Store / demo", the account and bell buttons on the left. The "verify your email" banner (أكّد بريدك الإلكتروني) with its code field and buttons, the trial strip, then the page title "الملاحظات" with both notes. RTL alignment correct. |
| `template-notes-ar-mobile.png` | The same at 390 px: sidebar collapsed behind its toggle, switcher "Demo Store / demo", banner buttons wrapped, title and both notes right-aligned. No overflow. |
| `template-notes-en-desktop.png` | English chrome ("Notes", "Catalog", "Verify your email", "Your trial details will appear here."), sidebar on the left, switcher "Demo Store / demo" on the right. Left-aligned, both notes listed. |
| `template-notes-en-mobile.png` | English at 390 px: banner, trial strip, "Notes" and both notes, left-aligned. No overflow. |
| `dashboard-content-language-ar-desktop.png` | The store switcher open in Arabic: "Demo Store / demo" checked, "Demo Store 2 / demo2", then "إنشاء متجر". The store archived earlier in this run is not listed. The menu covers part of the banner, as an open menu does. |
| `dashboard-content-language-ar-mobile.png` | The same menu at 390 px, inside the viewport, with the same three rows. |

The verification banner is on every dashboard shot because the seeded owner's email is unverified by design (P1.S2); it is the only `role="alert"`, and the script fails on any other. No error or toast otherwise. No third-party name on any of these shots; the dashboard login page, which carries the licence-required footer (ADR 0001), is not among them. The notes bodies "evidence" and the store names are the script's synthetic data, not untranslated UI strings. "CodShop Assistant" in the top bar is our own product name.

D7 (switching store sets the content language to the store's language) is asserted by the script from the stored user settings, not read off a shot: the merchant switcher has no content-language row since P1.S5. The earlier flags (a hex channel code in the switcher, an archived store listed) were fixed by P1.S5 and are no longer seen.
