# Evidence for P1.S5 (admin shell, navigation and Arabic RTL)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S5.sh`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
`d539c68b249ac7f005c2e8c55f80ab0ef9fd9604`. Compose project `cod-evidence`.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/switchable-stores.md`](api/switchable-stores.md) | `switchableStores` for the owners of two businesses and a selected-store member; anonymous and a foreign channel token FORBIDDEN |
| [`api/create-store.md`](api/create-store.md) | `createStore`, the new store in `switchableStores`, `archiveStore`, the archived store absent |
| [`api/stock-refused.md`](api/stock-refused.md) | The merchant's stock `orders` query FORBIDDEN |

Store and business ids and channel tokens are placeholders; every assertion ran on the real values. Channel ids are the engine's small integers.

## Screenshots

`screens/<screen>-<lang>-<viewport>-<theme>.png`, for desktop (1280 px) and mobile (390 px), Arabic and English, light and dark:
`home`, `sidebar` (Finance open; on mobile the sidebar sheet), `switcher-open`, `create-store` (a taken address typed),
`account-menu`, `settings`, `skeleton-leaf` (`/cod-orders/spam`), `store-leaf` (`/stores/active/products`),
`not-found-stock-route` (`/orders`), `not-found-other-business-store` (`/stores/<B's store id>/products`), and
`staff-nav` (the superadmin; on mobile the sidebar sheet). 88 files.

## Browser assertions in `scripts/evidence/P1.S5-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every merchant shot: dir matches the language, the dark class matches the theme, no horizontal overflow.
- Every merchant shot: the framework's name appears only inside the licence notice (the account menu's).
- Every merchant shot: at most one sidebar entry carries the active marker; the open Finance page shows exactly one.
- Create store, in both languages: the dialog's close button is visible and does not cover the title text.
- A stock route (/orders) and another business's store id both show the merchant not-found page, with no table.
- The superadmin keeps the stock sidebar and has no merchant account menu.

## What was seen in each screenshot (opened by eye, CLAUDE.md §3a.17)

Applies to every merchant shot: no third-party product name or logo except the licence notice inside our account menu
(D79, ADR 0001 §8), and the script fails if the framework's name shows anywhere else. Arabic shots are `dir=rtl`: sidebar on
the right, labels, titles and breadcrumbs right-aligned, chevrons pointing the inline way, Arabic font loaded. English shots are
`dir=ltr`. No horizontal page overflow (asserted on every shot). The seeded owner's email is unverified, so the verification card
is expected; the grey band below it is the inert trial placeholder (P9.S1). `CodShop Assistant` is our own placeholder product
name (D93) and stays Latin in Arabic. Store names (`Demo Store`) and subdomains are synthetic data. Dark shots use the stock dark
tokens: body text, sidebar labels, menus and dialogs read clearly; only disabled buttons (Save with nothing changed, Create with a
taken address) are dim, as intended.

| File(s) | Seen |
| --- | --- |
| `home-*` | The merchant tree in order (Home, Orders, Tracking, Products, Analytics, Inventory, Finance, Team, Delivery & shipping, Apps, Sourcing, Settings), Home marked. Top bar: sidebar toggle and one crumb, then Credits and the assistant (desktop only), the store switcher with name over subdomain, the bell and the account button. No stock store switcher or user menu in the sidebar, no "Administration" heading. The skeleton card says the page is coming soon in the page language. On a phone the sidebar is closed and the top bar keeps the toggle, switcher, bell and account. |
| `sidebar-*` | Finance open on Costs, with Report, Costs, Products, Wilayas, Ads, Wallets, Product study; on a phone, the sidebar sheet on the right in Arabic and on the left in English. After the fix below only Costs carries the marker, which sits on the side the text starts. |
| `switcher-open-*` | Demo Store (checked) and Demo Store 2, each with its LTR subdomain under the name, a separator, then Create store with its plus icon. The menu opens under the switcher and fits a 390 px screen. |
| `create-store-*` | Title, Store name, Store address with `demo` typed and the server's translated "already taken" message, `.localhost` after the input reading left to right in Arabic too, Store language with its hint, Cancel and a disabled Create; on a phone the buttons stack. After the fix below the close button is at the inline end in both languages. |
| `account-menu-*` | Name and email, Profile, Security, Language and Theme submenus, Log out, then the licence notice. The menu opens toward the page and fits on a phone. |
| `settings-*` | General settings: the Business card (name, Save disabled until changed) and the Store card (name, description, language). The page scrolls inside its own container, so the full-page shot ends at the window's bottom with the Store card cut; nothing overflows sideways. Settings is open in the sidebar with General marked. |
| `skeleton-leaf-*` | `/cod-orders/spam` (Spam in English) under Orders: crumbs Orders › Spam, the coming-soon card. After the fix below only Spam is marked. |
| `store-leaf-*` | `/stores/active/products`: All products under Products, crumbs Products › All products, the coming-soon card. |
| `not-found-stock-route-*` | `/orders`, a stock page: our not-found page (title, illustration, message, Go back, Go to dashboard), no order table (asserted). |
| `not-found-other-business-store-*` | `/stores/<B's store id>/products`: the same not-found page; the merchant stays on their own store. |
| `staff-nav-*` | The superadmin keeps the stock dashboard: the stock channel switcher in the sidebar header, Insights, Catalog, Sales, Customers, Marketing, the Administration group (Settings, System) and the stock user menu in the footer; no merchant toolbar. Arabic and dark apply to it as well. |

### Defects

- **Fixed (`fix(merchant-shell): one marked sidebar entry, and the dialog close button in Arabic`).** Two sidebar entries were
  highlighted at once: on `/cod-orders/spam` both All orders and Spam, on `/finance/costs` both Report and Costs. The
  stock sidebar marks a leaf active on a prefix match, and a group's own page is its first child (D80). Our stylesheet now drops
  the active look from the first child when a later sibling is active; a browser test and this script (exactly one marked entry
  on the open Finance page, at most one on every shot) check it.
- **Fixed (same commit).** In Arabic the Create store dialog showed no close button: the stock button is pinned to the physical
  right, under the start of the Arabic title. It now sits at the inline end for every dialog; a browser test and this script
  (the button does not cover the title text) check it.
- **Fixed in this script.** The first runs failed for reasons of the script or the host, not the shell: hiding the licence notice
  by inline style does not work against its `!important` rule, so the name check now skips its text nodes; the staff check
  counted sidebar entries before they rendered; and under heavy IO a fresh Postgres and the container creation outlasted their
  waits, so Postgres now starts and is waited for first, and a cut-short `up` is cleaned before its retry.

### Seen, not changed here

- On `/orders` the crumbs are the stock route's (Sales › Orders) and the trial band is missing, since the guard replaces the
  page below the band. Breadcrumbs are fixed by the dashboard (plan, verified facts); the not-found content itself is ours.
- The superadmin's "Administration" heading stays English in Arabic (D77: platform staff only).
- The General settings shots stop at the window height because the page scrolls inside its container.
