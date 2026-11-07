# ADR-0004: Pricing engine and order totals (signed quote → Vendure order)

**Date**: 2026-11-07
**Status**: Proposed (draft for P0.S2a; spike B confirms the Vendure strategy mechanics)
**Deciders**: architect (draft), user

## Context

- The storefront protocol is: `POST /store/cart-quote` returns lines, discounts, delivery, total, a nudge and a `quoteToken` = `qt1.<base64url JSON {v,b,s,h,exp,t,sh,l,d,a}>.<HMAC>` valid for about 15 min. The order submit carries the token and the order must match it [DM "Storefront ordering protocol" steps 2–5].
- The offer engine has 7 kinds (quantity tiers, free delivery, product discount, codes, BXGY, order discount, add-ons) with combination rules, eligibility and nudges [DM "Offer"; feature-inventory §7, X]. Vendure Promotions can express some of this, but not nudges, "skipped + reason", app-defined kinds or a signed commitment.
- Vendure extension points: `OrderItemPriceCalculationStrategy.calculateUnitPrice(ctx, variant, lineCustomFields)` returns `{price, priceIncludesTax}`; `ShippingCalculator`; `PromotionAction`; custom `OrderProcess` [VN §10]. In the v3.8 doc snippet the strategy reads `productVariant.listPrice`, so check the exact signature [VN §10 note].
- Quote volume is high: about 10 quote calls per order (8 cart quotes + 2 shipping quotes). That is about 139 rps at a Growth spike and 556 rps at a Scale spike (infrastructure.md capacity math).

## Options

1. **Vendure Promotions as the offer engine**: we get Vendure-native discount lines, but no nudges or skip reasons, a hard fit for quantity tiers with fixed totals and preselected tiers, and the per-request DB-heavy promotion evaluation runs on every quote. Rejected.
2. **Our own `PricingService` and recompute-on-submit, no token**: simple, but the buyer can see one total and be charged another if the merchant edits prices mid-checkout. It also contradicts the reference protocol. Rejected.
3. **Our own `PricingService` with an HMAC quote token as a price commitment, and totals forced into Vendure through strategies (recommended).**

## Decision

Option 3.

**Money**: integer DZD (`bigint`/`integer` minor units with exponent 0; DZD has no subunits in practice). Tax is 0 (a zero-rate tax category on a zero-tax zone, the default channel config). No floats anywhere. Shared `Money` type in `packages/shared`.

**Engine**: `PricingService.quote(ctx, cart, destination, phone?, codes?)` in plugin `pricing` (P2.S4). It is pure and deterministic over a **pricing snapshot**: active offers, variant prices, pack rules and the delivery-fee table for the store. The snapshot is cached per store in Redis plus an in-process LRU (key `pricing:{storeId}:{version}`) and invalidated by version bump on any offer/product/fee change (pub/sub). The quote path reads no rows from the DB on a warm cache. Target: p95 under 25 ms in-process, under 250 ms end to end (SLO, system-design §10).

**Token** `qt1.<payload>.<sig>`:
- Payload `{v:1, kid, b, s, h, exp, t, sh, l, d, a, n}`. `h` = SHA-256 of the canonical cart (sorted lines `variantId:qty`, destination, codes, phone hash if eligibility uses it). `n` = random nonce. `exp` = now + 15 min.
- Signature: HMAC-SHA256 with the platform key `kid` (keys in a versioned secret; rotation = add new `kid`, sign with new, verify old for 30 min, then remove).
- **Replay**: a token may create **one** order. On intake we `SET quote:used:{sha256(token)} orderId NX EX 3600` in Redis, and the database has a unique constraint `cod_order.quote_hash`. Resubmitting the same token + deviceId within 60 s returns the original order (P3.S4 acceptance).

**Intake verification** (P3.S4):
1. Check signature, `exp`, `b`/`s` against the host-resolved store, and `h` against the submitted cart. Any failure → `409 QUOTE_MISMATCH` with a fresh quote.
2. **The token is honoured as a commitment**: the order is created at the token's prices even if the merchant changed a price in the last 15 min.
3. We also recompute the quote. If the recompute differs from the token, we emit `pricing.quote_mismatch` (metric + log with both totals). This is a business alert (system-design §8), not a rejection.
4. Re-check only availability: product active, sold-out policy, stock policy.

**How the quote becomes Vendure totals** (spike B confirms each point):
| Quote part | Vendure mechanism |
|---|---|
| Line unit price after line-level offers (quantity tier, product discount, pack price) | `OrderLine.customFields.quotedUnitPrice` set at `addItemToOrder`. `QuoteOrderItemPriceCalculationStrategy` returns it (`priceIncludesTax: true`, tax 0). `originalPrice` and the per-line discount breakdown are stored in line custom fields for display and analytics. |
| Order-level discounts (order_discount, codes, BXGY "get" value when applied at order level) | One system `Promotion` per channel, "Quote discounts", with a custom `PromotionAction` that reads `Order.customFields.quoteDiscounts` (json) and returns those amounts. Vendure discount lines and totals stay correct. |
| Shipping (base + overweight − waived; 0 for free delivery) | `QuoteShippingCalculator` reads `Order.customFields.quotedShipping`. One "COD delivery" ShippingMethod per channel. |
| Add-ons | Separate order lines at their quoted price. |
| Tax | Zero-tax zone and category. |
| Order total | Must equal `t`. Intake asserts `order.totalWithTax === t` before transition, otherwise it rolls back and raises the mismatch alert. |

**Re-pricing after intake** (agent upsell P4.S3, edits): goes through `PricingService.reprice(order, change)`, which sets the same custom fields and lets Vendure recalculate. It never writes totals directly. A timeline audit diff is recorded.

## Consequences

### Positive
- The buyer-facing total is exactly what gets stored. The storefront and agents share one deterministic engine.
- Vendure totals, discount lines and shipping lines stay internally consistent for reports and fulfilment.
- The quote path is cache-only, so it scales with the spike numbers.

### Negative
- Offers are not Vendure Promotions, so the Vendure promotion UI is unused (hidden for merchants).
- The strategy signature may change across minors (watch in M.S1).

### Risks
- **Snapshot staleness.** Bounded by version-bump invalidation, the 15 min token commitment and the mismatch alert.
- **HMAC key leak.** The key lives only in the API's secret env, rotates by `kid`, and alerts fire on verification-failure spikes.
