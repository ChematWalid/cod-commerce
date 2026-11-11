# Tassyir feature inventory

Sources: public site (tassyir.io: features, pricing, developers, chrome extension, themes) and a read-only walkthrough of a logged-in Advanced-plan account on 2026-11-06.
Detail per screen (fields, columns, dialogs, endpoints): [research/dashboard-captures.md](research/dashboard-captures.md). Backend endpoint map: [research/api-surface.md](research/api-surface.md). Screenshots: [screens/](screens/).

Legend: **C** = Core, **S** = Secondary, **I** = Integration (external service). Checkbox = implemented and verified in our clone.
Routes are relative to `/[locale]/dashboard/:businessId`. `S:` = `/stores/:storeId`.

Product shape: multi-tenant SaaS. Account → Business (billing, team, finance) → 1..n Stores (storefront on `<sub>.tassyir.io` or a custom domain). Algerian cash-on-delivery: 58 wilayas → communes, home vs stop-desk delivery, DZD. Dashboard in EN/AR (RTL); storefront in AR/FR/EN. The same Next.js app serves the dashboard and the storefronts (by host).

---

## 1. Accounts, business, billing

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [x] | Register, login, logout, email verification (link + OTP), forgot/reset password, change password, change email | C | `/login`, `/register`, `/forgot-password` |
| [x] | Google and Facebook sign-in | I | login page |
| [x] | Business profile (logo, name) and onboarding state | C | `/settings` |
| [x] | Multi-store per business, store switcher with subdomain | C | top bar |
| [ ] | Plans Starter / Basic / Advanced, monthly or 3/6/12-month prepay (−10/−15/−20%) | C | `S:/store_settings?tab=plan` |
| [ ] | Plan quotas: orders/month (excl. duplicates, blocked, exchanges), stores, team seats, landing pages per product, stock-tracked items, AI credits | C | quota bar "This month's orders"; 80% warning |
| [ ] | Over-quota and expired-trial behaviour: orders accepted, buyer phone hidden until upgrade/renew | C | |
| [ ] | 7-day trial without card | C | |
| [ ] | Change plan, renew early, cancel renewal, payment history | C | |
| [ ] | Checkout with Edahabia/CIB (SATIM) and Visa/Mastercard (Stripe billing portal) | I | `/billing/checkout`, `/billing/stripe/billing-portal` |
| [ ] | AI credits: balance in top bar, buy credit packs, credit history | S | `/credits/*` |
| [x] | Locale switch EN/AR with RTL layout | C | `/en/...`, `/ar/...` |
| [ ] | Notifications centre (bell, mark read) | C | `/notifications` |
| [x] | Activity log | S | permission "View the activity log" |

## 2. Home dashboard

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Today KPIs: orders today (Δ vs yesterday same time), confirmed (%), returned today, delivered today | C | `/` |
| [ ] | "Needs you" action queue with deep links: to call, confirmed not dispatched, parcels not moving, cash held by carrier with no payout for N days, returns to process, abandoned checkouts today | C | |
| [ ] | Money on the way: cash held per carrier (overdue flag, parcel count), parcels still on the road | C | |
| [ ] | Today on the map (orders by wilaya) | S | |
| [ ] | Last 7 days summary (total/confirmed/delivered/cancelled) | C | |
| [ ] | Next steps nudges (e.g. products with no buy price) | S | |

## 3. Orders and confirmation

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Orders list: tabs All / To confirm / Callbacks / Ready to ship with counts; search by number, customer, phone, product; pagination | C | `/orders` |
| [ ] | Filters: store, status, stock (short on stock), date presets + range, wilaya, product/variant, assignee, delivery type, duplicates, offer, promo code, has discount, item count | C | |
| [ ] | Statuses: Pending, Confirmed, Scheduled (callback), Canceled, Abandoned + merchant custom statuses; delivery and payment sub-statuses | C | |
| [ ] | Row actions: call, confirm, edit, inline status change, returning badge | C | |
| [ ] | Bulk: change status, assign, dispatch to carrier, export | C | |
| [ ] | Export dialog: all / this page; templates Everything / Delivery sheet / Accounting; Excel / CSV | C | `/orders/export` |
| [ ] | Create order manually: product/variant picker with qty, customer dialog (name, phone, wilaya, commune, address, home/stopdesk), notes | C | `/orders/create` |
| [ ] | Order detail: items, subtotal/shipping/total, delivery + payment status pills | C | `/orders/:id` |
| [ ] | Timeline of status changes with time spent in each stage | C | |
| [ ] | Internal comments on orders | C | |
| [ ] | Buyer record on order (orders / delivered / returned by phone), link to customer, edit contact, ban customer | C | `/orders/client-history?phone` |
| [ ] | Assignment panel: assignee, how assigned (auto/manual), assignment history | C | |
| [ ] | Parcel opening allowed / not (per carrier setting) | S | |
| [ ] | Order source attribution: channel (store, dashboard, integration), traffic source, campaign/ad/UTM | C | |
| [ ] | More actions: set custom status, schedule (callback date), exchange order (linked second parcel), add discount, duplicate order, trust this device, cancel with reason | C | |
| [ ] | Cancel reasons (coloured, optional required note, suggested set) | C | settings |
| [ ] | Custom order fields | S | `/orders/:id/custom-fields` |
| [ ] | Duplicate detection and merge | C | |
| [ ] | Abandoned checkouts captured from storefront form | C | `/orders?status=abandoned` |
| [ ] | Stock warning when confirming | C | `/orders/:id/stock` |
| [ ] | WhatsApp order confirmation | I | `/integrations/whatsapp` |
| [ ] | "Ask Tassya about your orders" (AI) | I | |

## 4. Customers and spam protection

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Customers list: All / Repeat / New / Returned an order / Blocked; filters store, order status, orders, returns, spent, last order, wilaya; sort; export | C | `/orders/customers` |
| [ ] | Customer detail page | C | `/orders/customers/:id` |
| [ ] | Ban / unban by phone or device | C | `/orders/ban`, `/orders/unban` |
| [ ] | Spam: held orders list (by order / by device) | C | `/orders/spam` |
| [ ] | Protection level Off / Standard / Strict | C | `S:/store_settings?tab=spam` |
| [ ] | Rule builder with templates (schema-driven conditions) | C | `/settings/spam-rules/new` |
| [ ] | Trusted team devices, allow-listed numbers, blocked devices/numbers list | C | |
| [ ] | Daily summary of held orders at 20:00 | S | |

## 5. Tracking, returns, exchanges

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Tracking list: Active / Awaiting validation / On the way / Delivered / All | C | `/tracking` |
| [ ] | Filters: store, status (Awaiting validation, To desk, In desk, In transit, Arrived at province, Suspended, Out for delivery…), movement (not moving), payment (awaiting carrier payment, paid, withdrawn), wilaya, dispatched date, assignee, delivery type, item count; refresh | C | |
| [ ] | Normalised status + raw carrier label; copy tracking number | C | |
| [ ] | Late-parcel detection (stuck longer than usual for its stage) | C | `?late=1` |
| [ ] | Export deliveries: Everything / Follow-up list / Cash reconciliation; Excel / CSV | C | |
| [ ] | Undispatch, validate parcels, label status, print labels | C | `/orders/undispatch`, `/orders/validate`, `/orders/labels` |
| [ ] | Returns: To process / Processed / All; filters; process to Restock or Damaged | C | `/tracking/returns` |
| [ ] | Scan returns with barcode (sound feedback, bulk restock/damaged) | S | |
| [ ] | Exchanges as linked parcel (exchange + process-return) | C | |
| [ ] | Courier notes surfaced as notifications | S | |

## 6. Delivery and shipping

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Carrier accounts list (agent, system, status), edit, refund rates, delete | C | `/delivery` |
| [ ] | Connect carrier from catalogue: Yalidine platform (Yalidine, Economiqua, Goupex, WeCan…), Ecotrack platform (DHD, Anderson, TSL, Navex, 48HR…), Maystro, ZR Express, NOEST, Elogistia, Ecom Delivery, Zimou, Osen; Private Courier | I | adapter per "system" |
| [ ] | Multiple accounts per carrier; choose carrier per order; default per store | C | |
| [ ] | Delivery pricing options: name, carrier, overweight charge, per-wilaya home and stop-desk prices for 58 wilayas, apply-to-all, per-wilaya delivery toggle, overrides, sync defaults from carrier | C | `/delivery?tab=pricing` |
| [ ] | Dispatch to carrier API, tracking number back, carrier rejection reason | I | |
| [ ] | Status sync from carriers (webhook/polling) | I | |
| [ ] | Carrier cash collection and payouts tracking | C | finance |
| [ ] | Wilaya and commune reference data | C | `/provinces`, `/provinces/code/:code` |

## 7. Products, catalog, offers

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Product list: All / Draft; filters collection, brand, tag; search name/SKU/barcode; preview, edit, customize page, set draft | C | `S:/products` |
| [ ] | Product types: physical product and Pack (bundle) | C | |
| [ ] | Product form: title, rich-text description, main + additional images, price, old price, SKU, weight, package size, variants (options × values), status Active / Hidden (landing-page only) / Draft, brand, collections, tags, custom fields, highlights (max 6), SEO listing | C | `S:/products/add`, `S:/products/:id/edit` |
| [ ] | Product settings: name on delivery label, fragile, keep selling when out of stock, quantity rules, dedicated order managers | C | |
| [ ] | Bulk edit, export | S | |
| [ ] | Import products from a link (scrape + AI polish) or spreadsheet (analyze → preview → confirm) | S | `/scrape/*`, `/import-export/*` |
| [ ] | Collections: image, title, description, manual products or automatic conditions, visibility, position | C | `S:/categories/new` |
| [ ] | Offers: quantity offer, free delivery, product discount, discount codes, buy X get Y, order discount, add-on (pre/post purchase upsell) | C | `S:/offers` |
| [ ] | A/B tests: landing page vs product page, lifecycle | S | `S:/ab-tests` |
| [ ] | Landing pages per product (plan-limited) | C | builder `product` pages |
| [ ] | Sold-out behaviour: keep showing or hide; stop/resume orders | C | store settings |

## 8. Store, themes, builder, storefront

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Store profile: logo, name, description, language AR/FR/EN, default delivery fee group, default carrier, show address field | C | `S:/store_settings` |
| [ ] | Free subdomain (availability check, change) | C | |
| [ ] | Custom domains: connect, DNS instructions, verify, make primary, enable/disable | C | `?tab=domains` |
| [ ] | Themes: current theme card (history, preview, edit), my themes (try on store, apply), marketplace of 10 free themes incl. Arabic variants, theme versions | C | `S:/themes` |
| [ ] | Visual builder: pages (Home, Product pages incl. per-product landing pages, Collection, Checkout, Success, Search), desktop/mobile preview, undo/redo, preview, publish, draft vs published | C | `S:/builder/:page` |
| [ ] | Sections: announcement bar, header, footer, hero banner, image with text, rich text, scrolling banner, story, back to top, collapsible content, follow block, before & after, cards, collections grid, product grid, reviews, offer deadline (countdown), FAQ, chat buttons (WhatsApp/Messenger/call), trust badges, custom HTML; show/hide, reorder, actions | C | |
| [ ] | Styles: colours, typography, buttons & corners, components, layout & motion, page code (custom JS) | C | |
| [ ] | AI design assistant inside builder (Tassya) and via Claude/ChatGPT MCP | I | |
| [ ] | Storefront: home, product list, product page with variant pickers and quantity, cart, category, search | C | `<sub>.tassyir.io/`, `/products`, `/product/:slug`, `/category/:slug`, `/search` |
| [ ] | COD order form on product page: full name, phone, wilaya → commune, delivery type, live delivery fee and total (cart quote), Buy it now / Add to cart / Confirm order | C | `/store/cart-quote`, `/orders/public` |
| [ ] | Abandoned checkout capture from form | C | `/orders/abandoned-checkouts/public` |
| [ ] | Visitor tracking and live beacon (live visitors) | S | `/visitors/track`, `/live/beacon`, `/live/snapshot` |
| [ ] | Pixels: Meta (pixel + Conversion API with delivered/confirmed/returned events), TikTok (pixel + Events API token), Snapchat, Google Ads, Google Analytics, Google Tag Manager; CAPI health check | I | `?tab=tracking` |
| [ ] | Product catalog feed URL for Meta/TikTok/Snapchat/Google Merchant | S | |

## 9. Inventory

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Stock per variant: on shelf, at carrier, damaged, cost per unit; expand variants; filters store, stock status (low, out, at carrier) | C | `/inventory` |
| [ ] | Add stock (product picker), adjust stock, import stock sheet (xlsx/csv, preview), export | C | |
| [ ] | Auto movements: −1 on dispatch, +1 on restocked return, damaged bucket | C | |
| [ ] | Movements history: type, item, direction, reason, note, price, date, link to order | C | `?tab=movements` |
| [ ] | Packaging inventory: name, quantity, unit price, low-stock threshold, linked products; available/transit/delivered/damaged | S | `?tab=packaging` |
| [ ] | Stock locations: warehouse / shop / carrier hub, wilaya, address, ships from here | S | settings `?tab=locations` |
| [ ] | Buy-price history (cost frozen at time of sale) | C | |
| [ ] | Plan gate: 25 tracked items on Starter/Basic | C | |

## 10. Finance

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Profit report for a date range: collected revenue − product cost − delivery (net) − returns = gross profit − ad spend − expenses = net; profit and ad cost per delivered order; delivery and confirmation rates | C | `/finance` |
| [ ] | "Missing from this profit" checklist (no buy price, ad account disconnected, no costs) | S | |
| [ ] | Money in / money out, your money right now, cash outlook | S | `/finance/money-map`, `/finance/outlook` |
| [ ] | Carrier cash: held per carrier, payouts, record a collection into a wallet, opening balance | C | `/finance/cashout/delivery/*` |
| [ ] | Expenses: one-time / recurring / per order, categories (packaging, confirmation calls, shoot, influencer, rent, salaries, calls, other), scope (product / store / business), paid from wallet, next due, process due | C | `?tab=costs` |
| [ ] | Ad spend records: platform, currency (DZD/USD/EUR), amount, date, product, wallet | C | |
| [ ] | Exchange rates (what 1 USD costs you, history) | C | |
| [ ] | Per-product profit (losing money filter, spread shared costs) | C | `?tab=products` |
| [ ] | Per-product by wilaya and per-product by ad (break-even cost per order) | S | `?tab=wilayas`, `?tab=ads` |
| [ ] | Link ad campaigns to products | C | `/finance/campaigns` |
| [ ] | Wallets: create (DZD/USD/EUR), add cash, spend, move money, correct balance, rename, archive; ledger with filters; capital add/reduce | S | `/finance/wallets` |
| [ ] | Product study simulator: buy/sale price, ad budget, ad cost per order, USD rate, confirmation and delivery rates, packaging, COD fee, return fee, delivery fee difference, fixed costs | S | `/finance/simulator` |
| [ ] | Plan gate: full finance on Advanced only | C | |

## 11. Analytics

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Overview: date range + comparison period, store filter; KPIs orders placed, confirmation rate, delivery rate, delivered sales, average delivered order | C | `/analytics` |
| [ ] | Daily orders by current stage (delivered, returned, on the way, to ship, to confirm, cancelled) | C | |
| [ ] | Funnel and "where orders are lost" (cancel reasons) | C | |
| [ ] | Reports with export, compare and drill-down to filtered lists: products, wilayas, carriers (days to deliver, cash held), team (time to confirm, delivered share) | C | `/analytics/reports/*` |
| [ ] | Marketing: source → campaign → ad tree with conversion, confirmed, delivered, spend, cost per delivered; platform filter | C | `?tab=marketing` |
| [ ] | AI questions ("Why did my numbers change?", "Where am I losing orders?") | I | |
| [ ] | Store visitors analytics | S | permission "View visitors" |

## 12. Team, roles, distribution

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Members list: All / Active / Pending / Inactive; roles, salary, status, order count, store access, joined | C | `/team` |
| [ ] | Invite by email with roles, store access (all / selected), base salary, commission structures | C | |
| [ ] | Member actions: view details, edit, set limit (max open orders), stop receiving orders, pay salary | C | |
| [x] | Roles: 7 built-in templates; custom roles with name, description, start-from template; 94 permissions (the research list of 93 plus `store.stores.archive`, D96) in 12 areas with None/View/Full per area and "Sensitive" flags (full list in research notes) | C | `?tab=roles` |
| [ ] | Order distribution: Evenly (fewest open) / In turn / Nobody; reclaim timeout; exception rules (ordered) | C | `?tab=distribution` |
| [ ] | Team stats report and commissions | S | |

## 13. Apps and integrations

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | AI assistants: Claude and ChatGPT via MCP connections | I | `/apps`, `/mcp/connections` |
| [ ] | Meta Ads and TikTok Ads (OAuth, spend import, status) | I | |
| [ ] | Store platforms: Shopify (up to 10 shops, product/order sync), YouCan, WooCommerce (plugin authorize/install link), Ayor | I | |
| [ ] | Google Sheets: export destinations, import orders from a sheet | I | `/apps/google-sheets` |
| [ ] | Order Dz integration | I | |
| [ ] | WhatsApp settings | I | |
| [ ] | App platform: installations, launch with id-token, embedded app pages | S | `/app-installations/*` |
| [ ] | Public Admin API, signed webhooks (orders created/confirmed/dispatched/delivered/returned), TS SDK, CLI, dev stores | S | developers page |

## 14. Sourcing

| ✓ | Feature | Type | Where / notes |
|---|---|---|---|
| [ ] | Import from China requests: shipping only or buy + ship; product, link, photos, units, weight, dimensions, WhatsApp, notes; cargo rates, balance, orders | S | `/sourcing`, `/cargo/*` |

## 15. Mobile and extension (outside the web clone unless decided)

| ✓ | Feature | Type | Notes |
|---|---|---|---|
| [ ] | Mobile app (iOS/Android): orders, push notifications, scan-to-validate parcels and returns | S | |
| [ ] | Chrome extension "Tassya": import product from AliExpress/1688/Temu/Amazon/Shopify pages, AI copy, price suggestion, draft landing page | S | |

---

## Added from the second pass (test account, actions performed)
Details: [research/second-pass.md](research/second-pass.md) · data models and protocols: [research/data-model.md](research/data-model.md).

| ✓ | Feature | Type | Area / notes |
|---|---|---|---|
| [x] | Sign-up wizard (3 steps) with store name, live subdomain availability, store language, logo | C | Accounts |
| [ ] | Onboarding checklist on Home (add product → connect carrier → test order → confirm) + "Example" data on empty dashboard | C | Home |
| [ ] | Account menu: Profile (photo, name, phone), Security (change password), Notification settings (browser push permission, per-event Email/Push toggles for new order, delivered, confirmed, dispatched, returned, cancelled, abandoned checkout, delivery note, assigned to me, scheduled, business updates; Send test), Language, Light/Dark theme | C | Accounts |
| [x] | Store switcher with "Create Store" | C | Accounts |
| [ ] | Notification feed entries per order event | C | Notifications |
| [ ] | Storefront pricing engine: cart-quote with offers applied/skipped + reasons, upsell nudge ("add 1 more, save X"), signed quote token, shipping-quote (base, overweight, waived, speed) | C | Storefront |
| [ ] | Commune data with ONS codes and per-commune home/stop-desk availability | C | Delivery |
| [ ] | Anti-bot signals on order submit: deviceId, page/form fill time, fbp | C | Spam |
| [ ] | Spam engine: built-in reasons (TEST_ORDER, JUNK_PHONE…), device fingerprint and 24h velocity, held list by order/by device, "Not spam" releases into orders, "Discard and block device", 30-day expiry | C | Spam |
| [ ] | Spam rule builder: If (≤10 conditions over order fields, buyer history, device/IP/ad-click/shared-link velocity, fill time, network abroad, in-app browser) Then To Spam / Flag as suspicious / Always accept; ≤25 rules | C | Spam |
| [ ] | Agent upsell panel on the order page (switch to quantity-offer tier with price delta) + audit diff in timeline | C | Orders |
| [ ] | Order states and actions: confirm, dispatch (with failure taxonomy), schedule callback, custom status, cancel with numbered reasons + note, restore, duplicate (prefill + recalculated total), mark as spam | C | Orders |
| [ ] | Order numbering per business (#00000001) | C | Orders |
| [ ] | Parcel drawer: stepper, Overview/History/Notes, Print label, Undispatch, Update Status (To Desk, In Desk, In Transit, Arrived at Province, Out for Delivery, Delivered, Returned) | C | Tracking |
| [ ] | Return processing dialog: back to stock / damaged / didn't arrive split, team notes | C | Returns |
| [ ] | Exchanges limited to carriers that support them (Ecotrack, Yalidine family, ZR, Ecom Delivery) | I | Returns |
| [ ] | Carrier connect forms: credentials per carrier (API ID/Token/Webhook secret/departure wilaya for Yalidine; Token/Base URL for Ecotrack; API key/ID for ZR; GUID/Token for NOEST…), auto-validate on dispatch, parcel-opening note, overweight fee (allowance + rate, volumetric for ZR), parcel opening allow/deny | I | Delivery |
| [ ] | Private courier tied to a team member | C | Delivery |
| [ ] | Default "Tassyir prices" delivery-fee table; carrier price sync keeps your overrides | C | Delivery |
| [ ] | Customer detail page: KPIs, orders, addresses, internal note, WhatsApp/Call/Create order, block with reason (+ cancel unshipped) across all stores | C | Customers |
| [ ] | Cancel reasons seed set (7 Arabic reasons), "require a reason" toggle; custom status with colour; label statuses for tracking | C | Settings |
| [ ] | Inventory per variant with buy price and low-stock level; auto stock-out on dispatch; adjust with reasons (Received, Correction, Stock count, Damaged, Theft or loss, Promotion or gift); transfers between locations | C | Inventory |
| [ ] | Automatic wallet ledger: stock purchases, return fees, carrier payouts; overdrawn warning; "What's coming" cash forecast | S | Finance |
| [ ] | Carrier collection with expected vs received and difference category | C | Finance |
| [ ] | P&L "at most" with missing-cost warnings; working money (carriers + road + stock) | C | Finance |
| [ ] | Product types incl. Pack (bundle pricing/variant/weight modes); AI image clean-up; product store-page template | S | Products |
| [ ] | Offer engine: 7 kinds (quantity, free delivery, product discount, discount codes, buy X get Y, order discount, add-on pre/post order) with audience, channels, schedule, usage limits, combination rules, live Arabic preview, draft/publish, performance stats | C | Offers |
| [ ] | Collections with automatic conditions (All/Any; tag, brand, price, on sale, title, option values) | C | Products |
| [ ] | Landing pages: per product or chosen variants; block editor (image, text, video incl. TikTok/YouTube, button to form/WhatsApp, spacer, benefits, reviews, before/after, FAQ, countdown, trust strip, custom code); order-form block config (fields, custom questions, delivery display, summary, sticky button, language/direction, after-order thank-you/WhatsApp/link); AI generation (20 credits) | C | Store |
| [ ] | A/B test wizard: product → competing pages → traffic split → winner metric (conversion, AOV, confirmation rate, delivery rate) | S | Store |
| [ ] | Builder: page templates (Home, Product pages incl. per-product override, Collection, Checkout, Success, Search); full section settings; styles (palettes, Arabic font pairings, RTL/LTR, order button, global product card, filters, layout & motion, page code JS, custom CSS); keyboard shortcuts; Tassya AI design tab | C | Store |
| [ ] | Plans as data (features + limits), providers Stripe / Chargily / SlickPay, quota with grace period and masked orders, credit packs | C | Billing |
| [ ] | Ask Tassya side panel (AI chat, page-aware context) | I | AI |
| [ ] | Order distribution: reclaim after N min of working hours, max hops then flag manager; exceptions by wilaya/source/total; product managers | C | Team |
| [ ] | Commissions configs, role duplicate, permissions catalog, invitation resend/revoke | S | Team |
| [ ] | CAPI test events and test mode for Meta/TikTok/Snapchat | I | Pixels |
| [ ] | YouCan / Ayor / Shopify order & product sync; media library | I | Integrations |
| [ ] | Custom domain inline connect → DNS records → verify | C | Store |
| [x] | Arabic dashboard (RTL, IBM Plex Sans Arabic) | C | i18n |

## Still not covered (needs outside accounts or would cost money)
- Real carrier dispatch, labels PDF and webhooks (need carrier API keys).
- Meta/TikTok/Shopify/Google/WhatsApp OAuth connections; MCP connection to Claude/ChatGPT.
- Plan checkout and credit purchase (payment), AI generation (needs credits).
- Team invitation emails (sends email to a real address) and salary payment.
- Mobile app, Chrome extension, Tassyir staff back-office (`/admin`, `/cargo-admin`).

## Left out of the read-only walkthrough of the real account
- Dialogs that pay, save, confirm, dispatch, process or delete were not submitted. The salary "Pay" dialog was not opened.
- OAuth "Connect" flows (Meta, TikTok, Shopify, Google) were not started.
- Customer-facing checkout was viewed but not submitted.
