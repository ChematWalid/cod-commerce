# Tassyir client API surface

Extracted from the dashboard's JavaScript bundles (63 chunks loaded in the session) on 2026-11-06, plus endpoints observed in network requests. `:p` = path parameter. All paths are served behind the `/_api` proxy on app.tassyir.io (backend host api.tassyir.io). HTTP methods are not visible in bundle strings; infer GET for lists, POST/PATCH/DELETE for actions.

This is a map of features to rebuild. Our clone must not call these endpoints.

## Auth & account
/auth/register · /auth/login · /auth/logout · /auth/profile · /auth/profile/change-password · /auth/reset · /auth/reset-password · /auth/verify-email/:token · /auth/verify-email-otp · /auth/change-email-request · /auth/confirm-email-change
/businesses/:id · /businesses/:id/onboarding · /business/:id/access · /business/:id/dashboard · /business/:id/home?storeId

## Orders
/business/:id/orders?… (list; filters page, limit, excludedStatuses, status, dateFrom, dateTo, assigneeId, productId, wilaya, …) · /orders/:orderId · /orders/public (storefront order intake) · /orders/abandoned-checkouts/public
/orders/:id/duplicate · /duplicate-prefill · /exchange · /exchange-prefill · /exchange/process-return · /mark-spam · /spam-preview · /previous-orders · /stock · /custom-fields
/orders/assignee · /orders/assignment-settings · /assignment-settings/summary · /orders/assignment-rules · /assignment-rules/:id · /assignment-rules/reorder
/orders/ban · /orders/unban · /orders/client-history?phone · /orders/validate · /orders/undispatch · /orders/labels · /orders/export · /orders/stock · /orders/analytics
/orders/returns · /orders/tracking · /orders/tracking/analytics · /orders/tracking/export · /orders/tracking/label-status
/cancel-reasons?includeArchived · /custom-status · /custom-status?kind=label · /custom-status/settings
/employees/order-managers

## Customers & spam
/customers · /customers/export
/spam · /spam/summary · /spam/held · /spam/settings · /spam/rules · /spam/rules/schema · /spam/blocks · /spam/trusted-devices

## Catalog & store
/products · /products/v1 · /products/:id · /products/bulk-edit · /products/export · /products/categories · /product-tags · /product-highlights · /brands
/import-export/fields · /import-export/formats · /import-export/products/analyze · /import-export/products/imports/:id · …/preview · …/confirm · /import-export/stock
/scrape/import-job · /scrape/products/:id/polish (AI rewrite, SSE events)
/shopify/stores · /shopify/products/sync · /products/sync · /products/sync/status · /products/links
/stores · /stores/:id · /stores/subdomain-availability · /stores/:id/builder/config · /stores/:id/builder/themes · /stores/:id/storefront-filters · /stores/:id/sold-out-products (+ /stop-orders, /resume-orders) · /stores/:id/meta-capi/health · /stores/capi-health
/themes · /themes/:handle · /ab-tests · /ab-tests/:id · /ab-tests/:id/lifecycle
/domains · /domains/:id · /instructions · /verify · /make-primary · /toggle-activity
/upload

## Delivery
/delivery-agents (catalog) · /business/:id/delivery-agents · /delivery-fees · /delivery-fees/v1 · /delivery-fees/:id · /delivery-fees/:id/overrides(/:id) · /delivery-fees/agent/:id/sync-default (+ /status)
/provinces · /provinces/code/:code (communes)

## Inventory
/inventory · /inventory/by-product · /inventory/export · /inventory/locations · /inventory/packages · /inventory/history

## Finance
/finance/analytics · /finance/pnl · /finance/products · /finance/products/:id/wilayas · /finance/products/:id/ads · /finance/health · /finance/money-map · /finance/outlook?days
/finance/campaigns · /finance/campaigns/:platform/:id/link · /finance/ads-spend(/:id) · /finance/exchange-rates
/finance/cashout/delivery · /cashout/delivery/summary · /cashout/delivery/payouts · /payouts/refresh · /cashout/delivery/opening-balance
/finance/wallets · /finance/wallets/funding · /finance/transactions · /finance/movements · /finance/movements/due · /finance/capital · /capital/add · /capital/reduce
/expenses · /expenses/:id · /expenses/process-due
/simulations · /simulations/:id

## Analytics
/analytics/overview · /analytics/overview/store/:id · /analytics/summary · /analytics/cards · /analytics/cards/orders · /analytics/sections/:section · /analytics/variants · /analytics/marketing · /analytics/cancel-reasons · /live/snapshot

## Team
/employees · /team/members · (roles & commissions via team endpoints)

## Billing & credits
/plans · /billing · /billing/checkout · /billing/payments · /billing/subscription · /billing/subscription/quota · /billing/stripe/billing-portal
/credits/packs · /credits/packs/:id · /credits/balance · /credits/purchase · /credits/transactions

## Integrations & apps
/integrations/facebook-ads (+ /status) · /integrations/tiktok-ads (+ /status) · /integrations/whatsapp · /integrations/google-sheets (+ /configure, /import-orders, /unlink)
/woocommerce · /woocommerce/plugin/authorize · /woocommerce/plugin/install-link · /order-dz/integrations
/apps · /app-installations · /app-installations/:id/launch · /app-installations/:id/id-token · /app-installs/preview
/mcp/connections?businessId
/cargo/rates · /cargo/balance · /cargo/requests · /cargo/orders · /cargo/orders/:id · /cargo/uploads

## Added in the second pass (306 paths total after mining chunks from 12 more pages)
Methods confirmed by performing actions are marked.
- Orders: `POST /orders/confirm/:id` · `POST /orders/cancel/:id {cancelReasonId?, note?}` · `POST /orders/schedule/:id {scheduleDate}` · `POST /orders/deliver/:id` · `POST /orders/return/:id` · `PATCH /orders/:id {status}` · `PATCH /orders/tracking/:id {trackingStatus}` · `POST /orders/dispatch {ids, agentId}` · `/orders/dispatch/preflight` · `/orders/bulk` · `POST /orders/:id/duplicate` · `/orders/:id/comments` · `/orders/:id/discounts(/:id)` · `/orders/:id/offer-options` (agent upsell panel) · `/orders/:id/reprice-preview` · `/orders/:id/shipping-quote` · `/orders/stopdesk-options` · `POST /orders/returns/process/:id {products[{productId, variantId, totalQuantity, damageQuantity}]}` · `/orders/returns/:id`
- Storefront (public, api.tassyir.io): `POST /store/cart-quote` · `POST /store/shipping-quote` · `/store/products` · `/store/product/:slug` · `/store/product/search` · `POST /business/:bid/orders/public` · `POST /business/:bid/orders/abandoned-checkouts/public` · `/business/:bid/visitors/track` · `/business/:bid/live/beacon` · `/store-preview` (builder iframe)
- Offers: `POST /stores/:sid/offers` · `POST /stores/:sid/offers/:id/publish` · `GET /stores/:sid/offers/app-types`
- Landing pages: `POST /landing-pages` · `/landing-pages/:id`
- Inventory: `POST /inventory/batch` · `/inventory/add/:id` · `/inventory/adjust/:id` · `/inventory/summary` · `/inventory/tracked-items` · `/inventory/untrack` · `/inventory/transfers` · `/inventory/locations/:id/default` · `/inventory/locations/consolidate` · `/inventory/packages/adjust/:id`
- Finance: `POST /finance/cashout/delivery {deliveryAgentId, walletId, note}`
- Team: `/employees/:id` · `/employees/:id/pay` · `/employees/:id/revoke-invitation` · `/employees/resend-invitation` · `/employees/analytics/:id` · `/roles/:id` · `/roles/:id/duplicate` · `/permissions` · `/permissions/catalog` · `/commissions/configs(/:id)` · `/commissions/configs/actions`
- Settings: `POST /custom-status {name, description, color}` · `/custom-status/:id` · `/cancel-reasons`
- Delivery: `/delivery-agents/:id`
- Pixels/CAPI: `/stores/:sid/meta-capi/test-events` · `/stores/:sid/meta-capi/test-mode` · `/stores/:sid/tiktok-capi/test-events` · `/stores/:sid/snapchat-capi/test-events` · `/stores/:sid/:platform/test-mode`
- Integrations: `/youcan/stores/:id` · `/youcan/stores/sync-orders` · `/youcan/stores/sync-products` · `/ayor/link` · `/ayor/sync-orders` · `/ayor/unlink/:id` · `/shopify/store` · `/shopify/available-stores` · `/shopify/stores/:id` · `/auth/shopify/url/:shop` · `/:platform/stores/:id/sync-orders` · `/apps-catalog(/:id)`
- Media library: `/media` · `/media/:id`
- MCP (AI assistants): `/mcp/capabilities` · `/mcp/connections(/:id)` · `/mcp/oauth/approve` · `/mcp/oauth/client-info`
- Out of scope (Tassyir staff back-office): `/cargo-admin/*` (sourcing operations: batches, quotes, purchases, receipts, payments, claims), `/admin/*`.
- Auth: dashboard uses a JWT (claims `id, email, iat, exp`) stored in localStorage and sent as `Authorization: Bearer`, plus `__Host-tsr_token` / `__Host-tsr_bid` cookies. Feature flags via PostHog (`whatsapp-feat`, `tassya`, `android-latest-version`…). Analytics: PostHog, Contentsquare, GA4, Meta pixel, Google Ads.

## Misc
/notifications · /notifications/read · /ops/copy-shown · /admin/* (Tassyir staff back-office: businesses, themes, demo stores, app reviews, CAPI health — out of scope)
