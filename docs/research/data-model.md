# Tassyir data model (from API responses)

Captured from responses in the **test account** (test-store-walid) on 2026-11-06. IDs are 18-digit snowflake-style numbers (string in JSON). Every row carries `businessId`; store-scoped rows also carry `storeId`. Timestamps ISO-8601 UTC. Money in DZD as plain numbers.

## Product — `POST /business/:bid/products` → 201
```
Product {
  id, businessId, storeId, type: PHYSICAL | (PACK),
  name, nameFolded (lowercased for search), nameInDelivery (label name), slug,
  description (rich text HTML), image (CDN url), gallery[],
  price, oldPrice, sku, barcode, weight, width, height, length,
  isInventoryTracked, IsStockInDeliveryAgent, allowOutOfStockOrders,
  isActive, isVisible   // Active / Hidden-from-store (landing only) / Draft
  quantityRulesEnabled, minQuantity, quantityStep,
  allowParcelOpening, isFragile,
  metaTitle, metaDescription,
  orderManagers[], deliveryFeeGroupId, categoryId, categoryIds[], brandId, label, cardCaption,
  packageInventoryId, bundleId, bundle,
  packPricingMode, packDiscountType, packDiscountValue, packVariantMode, packSharedOption, packWeightMode,   // Pack products
  maystroProductId,                     // carrier-side product sync (Maystro)
  source: manual | (import/scrape/shopify…), importJobId, scrapImportNeedsImageReview,
  options: ProductOption[], variants: ProductVariant[],
  customFields[], tags[], highlights[], collections[], brand,
  createdAt, updatedAt
}
ProductOption { id, productId, name, position, isActive, values: string[], value: [{ value, color, image }] }
ProductVariant {
  id, productId, packageId, name ("Product - Red / S"), image, color,
  sku (auto: <sku>-n), barcode, isHidden, isDefault, isActive,
  selectedOptions: [{ name, value, optionId, optionValueId }],
  price, oldPrice, maystroProductId, zrProductId
}
```
Images upload to a Cloudflare-Images-style CDN: `https://cdn.tassyir.io/images/<uuid>/public`.

## Storefront ordering protocol (public, `https://api.tassyir.io`, no auth)
Storefront = `<sub>.tassyir.io` served by the same Next.js app. Calls in order:
1. `GET /provinces` and `GET /provinces/code/:code?storeId` → `Province { id, code, name, arabicName, names[] (aliases for matching), towns: [{ id, provinceCode, name, arabicName, names[], codeOns, isStopdesk, isHomeDelivery }] }`. Communes are keyed by **codeOns** (ONS commune code, e.g. 1652). The town dropdown labels "(مكتب متوفر)" = stop-desk available.
2. `POST /store/shipping-quote { storeId, provinceCode, stopdesk, items:[{productId, quantity}] }` → `{ baseFee, overweightFee, totalFee, resolved, speed, offeredSpeeds[], freeShipping, waivedFee }`.
3. `POST /store/cart-quote { storeId, channel: storefront, lines:[{productId, variantId, quantity}], destination:{provinceCode, stopdesk}, phone, codes? }` →
   `{ currency, lines:[{ key, productId, variantId, quantity, originalPrice, unitPrice, totalPrice, discounts[] }], discounts[], subtotal, discountTotal, delivery:{ resolved, fee, overweightFee, waived, price, freeShipping, speed }, total, savings, nudge:{ type: next_tier, offerId, units, tierQuantity, saving }, applied[], skipped:[{ offerId, reason: no_tier_reached… }], rejectedCodes[], suggestions[], quoteToken, expiresAt (~15 min), available, orderPricingMode }`.
   `quoteToken` = `qt1.<base64url JSON {v, b: businessId, s: storeId, h: cart hash, exp, t: total, sh: shipping, l: lines, d: discounts, a: addons}>.<HMAC>`: a signed price commitment the order must match.
4. Abandoned checkout, sent once name + phone + wilaya + commune are filled: `POST /business/:bid/orders/abandoned-checkouts/public { storeId, status: abandoned, total, shippingPrice, deviceId, fbp, orderClient:{ name, phone: +213…, provinceCode, townOns, address }, orderItems:[{ productId, variantId, quantity, bundleId, price, totalPrice }] }` → `{ id, status: abandoned, … }`.
5. Submit: `POST /business/:bid/orders/public { storeId, stopdesk, deviceId (uuid kept in localStorage), pageMs, formMs (time on page / in form: anti-bot), fbp (Meta cookie), quoteToken, overweightFeeShown, orderClient, orderItems }` → 201 `{ id, status: pending, total, shippingPrice, subtotal, discountTotal, discounts[], orderClient, orderItems[{…, product{name,image}, variant{name,image}}], track, addon }` → redirect to `/success` ("thank you, we will call you to confirm").
Also: `POST /business/:bid/visitors/track`, `POST /business/:bid/live/beacon` (live visitors). Phone is validated client-side (must start with 05/06/07) and stored as E.164 `+213…`.

## Spam hold (anti-fraud) — `GET /business/:bid/spam/held`
Storefront orders can be **held** before they become orders:
`{ id, createdAt, expiresAt (+30 days), channel, status: held, storeId, customer:{ name, phoneMasked "0555 •• •• 11", provinceCode, provinceName, townName }, items[], totalEstimate, reasons:[{ code, params }], device:{ os, browser, inApp, deviceType, key, submissions24h, phones24h, wilayas24h }, blocked }`.
Reason codes seen: `TEST_ORDER` (name looks like a test), `JUNK_PHONE {distinctDigits}`. UI: List / By device (device card: "Windows PC · Chrome — N orders · N numbers · N wilayas · last order", "Discard N and block device", "Show orders"), per row "Not spam" (→ becomes a real order, toast "Added to your orders as #00000001") / "Discard"; "Discard all".

## Billing (`GET /plans`, `/credits/packs`, `/billing/subscription`, `/billing/subscription/quota`)
- Plan `{ id (free_trial, starter_monthly, basic_monthly, advanced_monthly, …per term), name, description, billingCycle, termMonths, amount + currency (Stripe, EUR: Starter 4.99, Basic 14.99…), stripePriceId, chargilyAmount / slickPayAmount (DZD: 1,900 / 4,900 / 9,900), creditsPerCycle (Basic 40, Advanced 100), edahabiaLimit,
  features { team, stock, offers, orders, finance, returns, products, whatsapp, analytics, inventory, offer_reports, profit_overview, stores{enabled,limit}, employees{enabled,limit}, landing_pages{enabled,limit} },
  limitations { orders{ max_per_cycle, fair_use }, stores{ max_per_business }, employees{ max }, active_offers{ max }, landing_pages{ max_per_product }, tracked_items{ max } } }`. Free trial: everything unlimited for 7 days.
- Payment providers: **Stripe** (cards, EUR), **Chargily** and **SlickPay** (Edahabia/CIB, DZD).
- Subscription `{ id, provider, planId, status, currentPeriodEnd, cancelAtPeriodEnd, trialEnd, scheduledChange }` + `gracePeriod { isActive, daysRemaining }`.
- Quota `{ planId, ordersLeft, isStarterPlan, maskedOrders, quotaExhausted, allowance{ enforced, limit, used, waiting, waitingTotal, cycleStart, cycleEnd, cycleIndex, cycleCount, inGrace, alertLevel } }`. Over quota orders are stored but masked ("waiting") until upgrade.
- Credit packs: pack_100 / pack_200 / pack_500 at 1,000 / 2,000 / 5,000 DZD (SlickPay) or 5 / 10 / 25 EUR (Stripe). AI actions cost credits (e.g. landing page "Generate with AI" −20).
- UI: Plan & Billing shows "Free trial — ends on …", Choose a plan dialog (Monthly / 12 months −20%, Starter/Basic/Advanced, What's included, Choose), This month's orders, AI credits balance, Buy credits ("Add credits" → Buy now), Credit history.

## Spam rules — `GET /business/:bid/spam/rules/schema` (rule builder at `/settings/spam-rules/new?store=`)
Rule = **If** (conditions, AND) **Then** one of: *To Spam* (hold) / *Flag as suspicious* / *Always accept*. Unsaved-changes bar, Save.
Limits: maxRules 25, maxConditions 10, maxListValues 500, maxListChars 20k (business 60k), maxValueChars 100, nameMax 60, minContains 3, minWord 2, minPhonePrefix 4, maxTrustedDevices 50.
Fields (`group`, ops → value type):
- order: `name`, `address` (contains / contains_word → text_list); `phone` (in_list → phone_list, starts_with → phone_prefix_list); `wilaya` (in_list province_list 1–58); `product` (has_any product_list); `quantity` (gte / lte / between int); `delivery` (is home|desk); `source` (in_list: facebook, instagram, tiktok, snapchat, google, direct, other).
- history (usesHistory): `delivered`, `returned` (gte / lte count of past parcels for this phone).
- identity (velocity): `device_orders`, `device_phones` (in_1h / 6h / 24h / 7d, count 2–50 or 2–20), `device_ad_clicks` (6h/24h/7d), `shared_link` (1h/24h), `ip_orders` (10m/1h/6h, can't hold), `fill_time` (lte seconds 1–120), `network` (abroad), `app` (in-app browser: facebook, instagram, messenger, tiktok, snapchat, telegram, other_app, browser).
Thresholds (rule-quality hints): thinOrders 30, minDecided 5, minMatchedForShare 3, deliveredShare 0.2, broadShare 0.3…
Built-in reasons (no rule needed): TEST_ORDER, JUNK_PHONE, plus protection level Off / Standard / Strict.

## Order (dashboard) — `GET /business/:bid/orders`, `{ data[], pagination{ page, limit, totalCount, totalPages, hasNextPage, hasPreviousPage } }`
```
Order {
  id, orderNumber ("#00000001", per business sequence),
  status: pending | confirmed | scheduled | canceled | abandoned | <custom>…, statusColor, statusSince,
  statusHistory: [{ date, status, duration }],
  isSpam, spamCount, riskLevel, riskReasons, isMasked (phone hidden: quota/trial), isReviewed,
  isExchange, isExchangeReturn, exchangeOfOrderId, exchangeSiblingOrderId,
  purchaseDeferred, createdAt, scheduledDate (callback),
  stopdesk, importedTownHasStopdesk, townsWithStopdesk,
  total, subtotal, discountTotal, discountSummary{ discountTotal, codes[], offerTitles[] },
  deliveryFeeGroupId, deliverySpeed, shippingPriceSource (quote|manual|…), carrierFee,
  assignee, deliveryAgent{ id, system, name, image, status, globalAgentId },
  cancelReason, cancelNote, canceledAt, cancelSource,
  orderClient{ name, phone (+213…), provinceCode, province, townOns, town, address, importedProvince, importedTown, isBanned, banReason },
  orderItems[{ id, productId, variantId, name, image, quantity, price, originalPrice, discountAmount, totalPrice, bundleId, packParentItemId }],
  customFieldValues[], isMissingFields, missingFields[]
}
```
Default delivery agent is applied to new orders automatically (here the Private Courier).

## Inventory
- `POST /inventory/batch { inventories:[{ variantId, quantity, lowQuantity, price (buy price) }] }` → `Inventory { id, businessId, variantId, quantity, isLow, lowQuantity, reservedQuantity {}, price, location, createdAt, updatedAt }[]`.
- Inventory is per **variant** (packaging items too: `itemType`). A default stock location is created automatically.
- Movement (`GET /inventory/history`): `{ id, itemId, itemType: variant|package, action: in|out, quantity, price, previousQuantity, previousPrice, locationId, transferId, orderId, actorId, reason, note, itemDetails{ name, image, selectedOptions, product{id,name} }, createdAt }`.
  Reasons seen: `received` ("Initial inventory creation (batch)"), `order_dispatched` ("Order dispatched", out). Manual adjust reasons: Received, Correction, Stock count, Damaged, Theft or loss, Promotion or gift.
- Stock is only tracked once a product has inventory; returns processed before that did not create stock.
- UI: KPI tiles Sellable (qty + DZD value), At carrier, Low stock ("below your alert level"), Damaged. Add Stock = product picker → "Add Inventory for Variants" table (buying price, quantity, low-stock alert per variant; "Apply to all variants"; "leave empty to skip, 0 to start counting") → "Add Inventory (N variants)". Row: cost/unit (click to edit), "Adjust stock" dialog (Adjust by ±, current stock, reason), Actions → Details. The order page shows "In stock · 10 available" per line.

## Offer — `POST /stores/:sid/offers` → `POST …/:id/publish`
```
Offer {
  id, storeId, kind: quantity | free_delivery | product_discount | bxgy | order_discount | addon (+ app-defined),
  method: automatic | codes, title, label,
  config: kind-specific, e.g. quantity: { priceMode: percent|total, tiers: [{ pieces, price, preselected, freeDelivery, label: { ar } }] },
  combinesWith: { order, product, delivery },
  eligibility: { audience: everyone|first|returning, wilayas[], channels[], deliveryMethods[] },
  totalUsageLimit, perBuyerLimit,
  status: draft | active | paused | archived, startsAt, endsAt, publishedAt, pausedAt, archivedAt,
  codeCount, ownerInstallationId, ownerApp, legacyBundleId, version,
  targets: [{ role: buy|get|addon, refType: variant|product|collection, refId, name, image, productId, productName, missing }],
  performance: { orders, deliveredRevenue, discountGiven },
  createdBy, updatedBy, createdAt, updatedAt
}
```
