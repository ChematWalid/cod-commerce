# ADR-0004: Pricing engine and order totals (signed quote → Vendure order)

**Date**: 2026-11-07
**Status**: Proposed — spike B evidence below; the user confirms in the P0.S2a-1 PR review
**Deciders**: architect (draft), user

Citation keys: [VN §n] = `docs/architecture/research/vendure-v3.md` section n; [DM] = `docs/research/data-model.md`; [BK] = background knowledge, verify before relying on it.

## Context

- The storefront protocol: `POST /store/cart-quote` returns lines, discounts, delivery, total, a nudge, skipped offers with reasons and a `quoteToken` = `qt1.<base64url JSON {v, b, s, h, exp, t, sh, l, d, a}>.<HMAC>` valid for about 15 min ("signed price commitment the order must match"). The order submit carries the token [DM "Storefront ordering protocol" steps 3 and 5].
- The offer engine has 7 kinds (quantity tiers, free delivery, product discount, codes, BXGY, order discount, add-ons) with combination rules, eligibility and nudges [DM "Offer"; feature-inventory §7, X]. Vendure Promotions can express some of this, but not nudges, "skipped + reason", app-defined kinds or a signed commitment.
- Vendure 3.8.1 extension points, checked against the `@vendure/core@3.8.1` `.d.ts` files:
  - `OrderItemPriceCalculationStrategy.calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity)` → `{ price, priceIncludesTax }`. **The 5-argument form is confirmed** (`config/order/order-item-price-calculation-strategy.d.ts:71`).
  - `ShippingCalculator.calculate(ctx, order, args, method)` → `{ price, priceIncludesTax, taxRate, metadata? }`.
  - `PromotionOrderAction.execute(ctx, order, args, state, promotion)` → number (negative = discount); a `Promotion` needs at least one condition or a coupon code (`MissingConditionsError` otherwise).
  - `OrderService.addSurchargeToOrder(ctx, orderId, surchargeInput)`; a negative `listPrice` is accepted (spike B).
  - `MoneyStrategy { moneyColumnOptions, precision?, round(value, quantity) }`. `DefaultMoneyStrategy` = `int` column, `precision = 2`. `precision` is **one global value**, not per currency, and "has no effect on the stored value; it is merely a hint to the UI". The dashboard's `useLocalFormat()` divides by `10^moneyStrategyPrecision` and formats with that many fraction digits.
  - Custom field types are `string | localeString | int | float | boolean | datetime | relation | text | localeText | struct`: there is **no `json` type**.
- DZD: ISO 4217 and `Intl` give 2 fraction digits (`new Intl.NumberFormat('fr', {style:'currency', currency:'DZD'})` → `9 100,00 DZD`), but centimes are not used in practice; merchants, carriers and the reference product show whole dinars. ADR 0005 formats DZD with 0 fraction digits.
- Quote volume: about 10 quote calls per order (8 cart quotes + 2 shipping quotes), about 139 rps at a Growth spike and 556 rps at a Scale spike (infrastructure.md capacity math).

## Options

1. **Vendure Promotions as the offer engine**: Vendure-native discount lines, but no nudges or skip reasons, a hard fit for quantity tiers with fixed totals and preselected tiers, and DB-heavy promotion evaluation on every quote (Promotions are loaded and checked per order recalculation). Rejected.
2. **Our own `PricingService`, recompute on submit, no token**: simple, but the buyer can see one total and be charged another if the merchant edits prices mid-checkout, and it contradicts the protocol in [DM]. Rejected.
3. **Our own `PricingService` with an HMAC quote token as the price commitment, and the quote forced into Vendure totals through strategies (recommended).**

Order-level discount mechanism, sub-options compared in spike B:
- 3a. **One system Promotion per channel** with a custom `PromotionOrderAction` that returns the quote's order discounts. Vendure records a `Discount` on the order and distributes it over the lines (`DISTRIBUTED_ORDER_PROMOTION` adjustments, `proratedLinePrice`). **Chosen.**
- 3b. **Negative surcharge** (`addSurchargeToOrder` with `listPrice: -500`). Works (total 9 100), but the discount is not a `Discount`: `order.discounts` is empty, lines are not prorated (`proratedLinePriceWithTax` stays 5 000 / 4 000) and the tax summary base is 9 000 instead of 8 500, so discount reports, per-line refund amounts and Vendure's promotion-aware code see no discount. Kept only as a fallback if a future Vendure minor breaks 3a.

Money precision, sub-options:
- P2. Keep `DefaultMoneyStrategy` (precision 2): 9 100 DZD is stored as `910000`. Every boundary (quote, token, our tables, carrier APIs, CSV export, analytics) must multiply/divide by 100, and the merchant dashboard shows `9 100,00`.
- P0. **Custom `MoneyStrategy` with `precision = 0`** (same `int` column and rounding as the default): 9 100 DZD is stored as `9100`, the dashboard shows `9 100` with no decimals, and our code never scales. **Chosen.**

## Decision

Option 3, with 3a and P0.

**Money**
- Integer whole DZD everywhere: Vendure money columns, our tables, the quote, the token, events and APIs. `DzdMoneyStrategy extends DefaultMoneyStrategy { readonly precision = 0 }` set in `entityOptions.moneyStrategy` (plugin `pricing`, P2.S4; P0.S2b wires it). Rounding stays `Math.round(value * quantity)` (default since 3.1).
- Vendure `int` columns hold values up to 2 147 483 647 DZD per money value, which no single order, line or payment reaches. Our aggregate columns (wallets, analytics, finance sums) are `bigint`. `BigIntMoneyStrategy` is not needed.
- The platform is DZD-only: `precision` is global, so a second currency with subunits would need a new ADR (and a data migration ×100 for that currency only). Every channel is created with `defaultCurrencyCode = DZD`, `availableCurrencyCodes = [DZD]`, `pricesIncludeTax = true`.
- Tax is 0: one zero-rate `TaxCategory` with a 0 % `TaxRate` on the Algeria zone, which is every channel's default tax and shipping zone.
- Shared `Money` type (branded integer, whole DZD) and the formatter (ADR 0005) live in `packages/shared`; the formatter reads the precision from one shared constant `MONEY_PRECISION = 0` with a unit test on 9 100 DZD.

**Engine**: `PricingService.quote(ctx, cart, destination, phone?, codes?)` in plugin `pricing` (P2.S4). It is pure and deterministic over a **pricing snapshot**: active offers, variant prices, pack rules and the delivery-fee table for the store. The snapshot is cached per store in Redis plus an in-process LRU (key `pricing:{storeId}:{version}`) and invalidated by version bump on any offer/product/fee change (pub/sub). The quote path reads no rows from the DB on a warm cache. Target: p95 under 25 ms in-process, under 250 ms end to end (SLO, system-design §10). Vendure Promotions are **not** evaluated on the quote path; the only Promotion per channel is the system "Quote discounts" one below.

**Quote token** `qt1.<payload>.<sig>`
- `payload` = base64url (no padding) of canonical JSON (sorted keys, no whitespace): `{ v: 1, kid, b: businessId, s: storeId, h, exp, t, sh, l, d, a, n }`.
  - `h` = SHA-256 (hex) of the canonical cart: lines sorted by `variantId` as `variantId:qty`, destination (`provinceCode`, `townOns`, `stopdesk`), sorted codes, and the phone hash if any applied offer's eligibility used the phone.
  - `t` = total, `sh` = shipping price, `l` = lines `[{ variantId, qty, unitPrice, originalPrice, offerIds }]`, `d` = order-level discounts `[{ amount, offerId | code }]`, `a` = add-ons `[{ variantId, qty, unitPrice, parentVariantId }]`. All whole DZD integers.
  - `exp` = issue time + 15 min (epoch seconds); `n` = 96-bit random nonce.
- `sig` = base64url HMAC-SHA256 over the ASCII bytes `qt1.<payload>` with the platform key named by `kid`.
- **Key rotation**: keys live in a versioned secret `QUOTE_HMAC_KEYS = { kid: key }` with `QUOTE_HMAC_ACTIVE_KID`. Rotation: add the new key, switch the active `kid`, keep verifying the old `kid` for 30 min (2 × token lifetime), then remove it. Verification with an unknown `kid` fails like a bad signature.
- **Replay**: a token creates **at most one** order. Intake runs `SET quote:used:{sha256(token)} <orderId> NX EX 3600` in Redis, and `cod_order.quote_hash` has a unique constraint per business as the durable guard. Resubmitting the same token with the same `deviceId` within 60 s returns the original order (idempotent retry, P3.S4 acceptance); any other reuse → `409 QUOTE_USED`.
- The token is opaque to the storefront: it is never parsed client-side, and the response's visible fields (`total`, `delivery.price`, …) are what the buyer sees.

**Intake verification** (P3.S4)
1. Check signature, `kid`, `exp`, `b`/`s` against the host-resolved store (ADR 0006/0008), and `h` against the submitted cart. Any failure → `409 QUOTE_MISMATCH` with a fresh quote in the body.
2. **The token is honoured as a commitment**: the order is created at the token's prices even if the merchant changed a price in the last 15 min.
3. We also recompute the quote. If the recompute differs from the token, we emit `pricing.quote_mismatch` (metric + log with both totals). This is a business alert (system-design §8), not a rejection.
4. Re-check only availability: product active, sold-out policy, stock policy.

**How the quote becomes Vendure totals** (every row exercised in spike B, Evidence below)
| Quote part | Vendure mechanism | Spike B result (whole DZD) |
|---|---|---|
| Line unit price after line-level offers (quantity tier, product discount, pack price) `l[].unitPrice` | `OrderLine.customFields.quotedUnitPrice` (`int`) passed to `addItemToOrder(ctx, orderId, variantId, qty, { quotedUnitPrice })`. `QuoteOrderItemPriceCalculationStrategy` returns `{ price: quotedUnitPrice, priceIncludesTax: true }`; without the field it falls back to `variant.listPrice` (dashboard-created orders). `originalPrice` and the per-line offer breakdown go into further line custom fields for display and analytics (P3.S4). | Variant list prices 2 900 / 4 500 were overridden: `listPrice` 2 500 (×2) and 4 000 (×1) |
| Order-level discounts `d[]` (order_discount, codes, BXGY "get" value when order-level) | One system `Promotion` per channel, "Quote discounts": condition `has-quote-discounts` (true when `Order.customFields.quoteDiscounts` is set; a Promotion needs a condition), action `quote-discounts` returning `-Σ d[].amount`. `quoteDiscounts` is a `text` custom field holding the JSON array (no `json` custom field type exists). | `discounts: [{ "Quote discounts", -500 }]`; distributed −278 / −222 over the lines (item distribution −139, −139, −222); sum exact |
| Shipping `sh` (base + overweight − waived; 0 for free delivery) | `QuoteShippingCalculator` (`quote-shipping`) returns `{ price: Order.customFields.quotedShipping, priceIncludesTax: true, taxRate: 0 }`. One "COD delivery" ShippingMethod per channel with `default-shipping-eligibility-checker` (`orderMinimum` 0) and the carrier `FulfillmentHandler` (ADR 0009). | `shippingWithTax` 600 |
| Add-ons `a[]` | Separate order lines at their quoted price (same strategy). | not exercised separately (same path as lines) |
| Tax | Zero-tax zone and category. | `taxSummary` 2 rows, `taxTotal` 0 |
| Quote `subtotal` / `discountTotal` / `total` | `subtotal` = Σ `line.linePriceWithTax` (pre-proration); `discountTotal` = −Σ `order.discounts[].amountWithTax`; `t` = `order.totalWithTax`. Note: Vendure's `subTotalWithTax` is **after** order-level discounts (8 500), so it is not the quote subtotal. | `totalWithTax` 9 100 = 5 000 + 4 000 + 600 − 500 |
| Order total check | Intake asserts `order.totalWithTax === t` after `ArrangingPayment` (where Vendure re-runs `applyPriceAdjustments`) and before adding the payment; otherwise the transaction rolls back and the mismatch alert fires. | the re-run on `ArrangingPayment` kept 9 100 (strategies are deterministic over the custom fields) |

**Re-pricing after intake** (agent upsell P4.S3, edits): goes through `PricingService.reprice(order, change)`, which sets the same custom fields and lets Vendure recalculate. It never writes totals directly. A timeline audit diff is recorded.

## Consequences

### Positive
- The buyer-facing total is exactly what gets stored; spike B reproduced 9 100 DZD to the dinar through Vendure's own recalculation.
- Vendure totals, discount lines, prorated line prices and shipping lines stay internally consistent for reports, refunds and fulfilment.
- Whole-dinar integers end to end: no ×100 conversions at any boundary, and the merchant dashboard displays `9 100` without decimals out of the box (`moneyStrategyPrecision: 0`).
- The quote path is cache-only, so it scales with the spike numbers.

### Negative
- Offers are not Vendure Promotions, so the Vendure promotion UI is unused (hidden for merchants, ADR 0010).
- Precision 0 is global: adding a currency with subunits later is a new decision plus a migration.
- Proration of order-level discounts rounds to whole dinars per line (seen: −278 / −222 for −500). Line-level "net price" figures in analytics may differ by 1 DZD from a pro-rata in cents; totals are exact.

### Risks
- **Strategy signatures change across minors** (watch in M.S1): the 5-arg `calculateUnitPrice`, `PromotionOrderAction.execute` and `ShippingCalculator` shapes are pinned by a test that replays the spike B order (9 100 DZD) in CI.
- **Snapshot staleness.** Bounded by version-bump invalidation, the 15 min token commitment and the mismatch alert.
- **HMAC key leak.** The keys live only in the API's secret env, rotate by `kid`, and alerts fire on verification-failure spikes.
- **A Vendure code path that ignores `moneyStrategyPrecision`** (an email template, an export, a plugin) would print 91.00. Mitigation: our own templates and exports use the shared formatter; P0.S2b adds a dashboard check on an order detail page.

## Evidence

Spike B, 2026-11-07, scratch app outside the repo (`%TEMP%\p0s2a\spike-b`, a copy of a fresh `npx @vendure/create@3.8.1 --ci --db sqlite` scaffold; never committed).

**Versions**: Windows 11, Node `v24.22.1`, `@vendure/core` `3.8.1`, `better-sqlite3` `12.11.1`, `ts-node` `10.9.2`.

**Deviation (SQLite, not Postgres):** Docker was unavailable on this machine, so spike B ran on SQLite instead of the compose Postgres in the plan. The order/pricing/state logic is database-independent; the raw SQL of the order-number counter (ADR 0009) uses SQLite `?` placeholders and needs `$1` on Postgres. Each run copies the scaffold DB to a fresh file and boots with `synchronize: true` for the custom fields.

**Code** (scratch plugin `src/plugins/cod-spike/cod-spike.plugin.ts`, excerpts):
```ts
export class DzdMoneyStrategy extends DefaultMoneyStrategy implements MoneyStrategy {
    readonly precision = MONEY_PRECISION; // 0 (run p0) or 2 (run p2)
}
export class QuoteOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    calculateUnitPrice(ctx, variant, orderLineCustomFields, order, quantity) {
        const quoted = orderLineCustomFields.quotedUnitPrice;
        return quoted != null ? { price: quoted, priceIncludesTax: true }
            : { price: variant.listPrice, priceIncludesTax: variant.listPriceIncludesTax };
    }
}
export const quoteShippingCalculator = new ShippingCalculator({ code: 'quote-shipping', args: {}, /* … */
    calculate: (ctx, order) => ({ price: order.customFields.quotedShipping ?? 0, priceIncludesTax: true, taxRate: 0 }) });
export const quoteDiscountsAction = new PromotionOrderAction({ code: 'quote-discounts', args: {}, /* … */
    execute(ctx, order) { const raw = order.customFields.quoteDiscounts; if (!raw) return 0;
        return -(JSON.parse(raw) as { amount: number }[]).reduce((s, d) => s + d.amount, 0); } });
```
Custom fields: `OrderLine.quotedUnitPrice int`, `Order.quotedShipping int`, `Order.quoteDiscounts text`, `Order.orderNumber string`, `Order.businessId int`, `Channel.businessId int`, `Channel.orderSeq int default 0`.

**Setup** (script `src/spike-b.ts`, `bootstrapWorker(config)` with the dev server stopped, `RequestContextService.create({ apiType: 'admin', channelOrToken: channel, user: superadmin })`): zone "Algeria" (DZ), tax category "Zero rate" + 0 % rate; per business a channel (`DZD`, `pricesIncludeTax: true`, zone Algeria), two products with list prices 2 900 / 4 500 and `stockOnHand` 10, PaymentMethod `cod-<b>` (handler `cod`), ShippingMethod (`quote-shipping`, fulfilment handler `cod-stub-carrier`), Promotion "Quote discounts". Intake: `addItemToOrder` (2 × quoted 2 500, 1 × quoted 4 000) → `updateCustomFields({ quotedShipping: 600, quoteDiscounts: '[{"amount":500,"offerId":"o1"}]' })` → customer, address, `setShippingMethod` → `ArrangingPayment` → `addPaymentToOrder` (COD) → `Pending`.

**Run** `MONEY_PRECISION=0 npx ts-node --transpile-only src/spike-b.ts` (output, trimmed):
```
HAPPY summary {"state":"Pending","orderNumber":"#00000001","currency":"DZD","subTotalWithTax":8500,"shippingWithTax":600,
  "totalWithTax":9100,"total":9100,"discounts":[{"desc":"Quote discounts","amountWithTax":-500}],
  "taxSummary":[{"taxRate":0,"taxBase":8500,"taxTotal":0},{"taxRate":0,"description":"shipping tax","taxBase":600,"taxTotal":0}],
  "lines":[{"qty":2,"listPrice":2500,"proratedLinePriceWithTax":4722,"quoted":2500},{"qty":1,"listPrice":4000,"proratedLinePriceWithTax":3778,"quoted":4000}],
  "payments":[{"method":"cod-101","amount":9100,"state":"Authorized"}]}
ASSERT state=Pending true; totalWithTax=9100 expected=9100 true; taxTotal=0; orderPlacedAt set true
RAW lines [{"listPrice":2500,"quantity":2,"quoted":2500,"adjustments":"[{\"amount\":-278,\"type\":\"DISTRIBUTED_ORDER_PROMOTION\",\"data\":{\"itemDistribution\":[-139,-139]}}]"},
           {"listPrice":4000,"quantity":1,"quoted":4000,"adjustments":"[{\"amount\":-222,…,\"itemDistribution\":[-222]}]"}]
RAW shipping [{"listPrice":600,"adjustments":"[]"}]
```

**Money precision.** Same script with `MONEY_PRECISION=2` (prices ×100): `subTotalWithTax 850000`, `shippingWithTax 60000`, `totalWithTax 910000`, discount `-50000`, proration −27 778 / −22 222. So Vendure's default stores 9 100 DZD as **`910000`** (centimes); with `DzdMoneyStrategy` (precision 0) the raw DB value is **`9100`**. With precision 0 the Admin API reports `globalSettings.serverConfig.moneyStrategyPrecision = 0` (server booted on port 3100, query `{ globalSettings { serverConfig { moneyStrategyPrecision } } order(id: 1) { totalWithTax … } }` → `"moneyStrategyPrecision":0`, `"totalWithTax":9100`, `"shipping":600`). The dashboard's `useLocalFormat().formatCurrency` (`@vendure/dashboard/src/lib/hooks/use-local-format.ts`) formats `value / 10^precision` with `minimum/maximumFractionDigits = precision`; reproduced with `Intl`: `en` → `DZD 9,100`, `fr` → `9 100 DZD`, `ar` → `9,100 د.ج.`; at precision 2 it would show `DZD 9,100.00`. Plain `Intl` DZD default is 2 fraction digits, hence the explicit `maximumFractionDigits: 0` in ADR 0005. The dashboard page itself was not opened in a browser in this spike (API + formatter code only).

**Negative surcharge (3b)**: `addSurchargeToOrder(ctx, id, { description: 'Quote discount', sku: 'QUOTE-DISCOUNT', listPrice: -500, listPriceIncludesTax: true, taxLines: [] })` with no `quoteDiscounts` → `totalWithTax 9100`, `discounts []`, `surcharges [{ priceWithTax: -500 }]`, lines not prorated (`5000`, `4000`), tax base `9000`. Works, not chosen (see Options).

**Gotchas found**
- `OrderService.addPaymentToOrder` throws `must be called within a transaction` outside a resolver; intake wraps the whole flow in `TransactionalConnection.withTransaction(ctx, …)` (ADR 0009).
- `PromotionService.createPromotion` without conditions or coupon → `MISSING_CONDITIONS_ERROR`; hence the `has-quote-discounts` condition.
- Two variants of one product without options → `product-variant-options-combination-already-exists`; irrelevant to pricing, noted for seed scripts.
