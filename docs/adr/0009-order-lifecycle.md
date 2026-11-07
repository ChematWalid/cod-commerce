# ADR-0009: COD order lifecycle on Vendure

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-1/P0.S2a-2 review
**Deciders**: architect (draft), user

Citation keys: [VN §n] = `docs/architecture/research/vendure-v3.md` section n; [DM] = `docs/research/data-model.md`; [BK] = background knowledge, verify before relying on it.

## Context

- COD statuses: `pending | confirmed | scheduled | canceled | abandoned | <custom>…` with `statusSince` and `statusHistory` [DM "Order (dashboard)"], plus delivery/payment sub-statuses. Dispatch goes to a carrier, then tracking statuses, then delivered/returned; exchanges are linked parcels [feature-inventory §3, §5]. The P0 brief asks for an explicit mapping of eight states: pending, confirmed, scheduled, canceled, abandoned, dispatched, delivered, returned.
- Spam-held submissions are not orders yet. They get a number only on release [DM "Spam hold"; P3.S4].
- Vendure 3.8.1 (checked in `@vendure/core@3.8.1` sources): `orderOptions.process` is a list of `OrderProcess` objects whose `transitions` are merged (`mergeStrategy` default `merge`); `configureDefaultOrderProcess(options)` builds the default process with ten switchable checks; `OrderPlacedStrategy.shouldSetAsPlaced(ctx, from, to, order)`; `OrderCodeStrategy.generate(ctx)` (no order argument); `DefaultStockAllocationStrategy` allocates on `ArrangingPayment → PaymentAuthorized|PaymentSettled`; the default payment process moves the order to `PaymentSettled`/`PaymentAuthorized` when payments cover the total; the default fulfilment process moves the order to `Shipped`/`Delivered` "if the state is available" when all fulfilments reach it [VN §10].
- The order list filters on about 14 dimensions with tab counts [feature-inventory §3]. At Scale that is about 73 M orders per year (infrastructure.md).

## Options

1. **Replace Vendure's default process entirely with our states**: we lose Vendure semantics that plugins and the dashboard rely on (placed, stock allocation, fulfilment, payment). Rejected.
2. **Keep Vendure states only and track COD status purely in our own table**: the two state machines drift apart. Rejected.
3. **Extend the default process with four COD states, keep fine-grained and merchant-defined statuses as data, and project into a COD read model (recommended).**

## Decision

Option 3. Spike B ran every transition below on Vendure 3.8.1 (Evidence).

1. **Process** = `[configureDefaultOrderProcess({ checkAllItemsBeforeCancel: false }), codOrderProcess]` (plugin `order-ops`; P3.S4 lands the minimal version, P4.S2 the full one).
   - Custom states via declaration merging: `interface CustomOrderStates { Pending; Confirmed; Scheduled; Returned }`.
   - Transitions added (merged into the default ones):

     | From | To |
     |---|---|
     | `PaymentAuthorized` | `Pending` |
     | `Pending` | `Scheduled`, `Confirmed`, `Cancelled` |
     | `Scheduled` | `Pending`, `Confirmed`, `Cancelled` |
     | `Confirmed` | `Pending` (restore), `Cancelled`, `PartiallyShipped`, `Shipped` |
     | `Shipped` | `Delivered`, `Returned` (plus the default `PartiallyDelivered`, `Delivered`, `Cancelled`, `Modifying`) |
     | `Cancelled` | `Pending` (restore, permission-gated) |
     | `Returned` | none |
   - **Default checks: only `checkAllItemsBeforeCancel` is disabled.** With it on, `transitionToState('Cancelled')` from `Confirmed` is blocked (`message.cannot-transition-unless-all-cancelled`), and Vendure's own `cancelOrder()` sets every line quantity to 0 (the order keeps only its 600 DZD shipping) so the order can never be restored. We cancel by transition and keep the lines. Every other check stays on, in particular `checkFulfillmentStates` (`Shipped`/`Delivered` only through fulfilments), `checkPaymentsCoverTotal` and the four `arrangingPaymentRequires*` checks.
   - Compensations in `codOrderProcess.onTransitionEnd`, inside the same transaction: on `→ Cancelled` from a placed, not-shipped state, `StockMovementService.createReleasesForOrderLines` (allocations released); on `Cancelled → Pending`, `createAllocationsForOrderLines` (re-allocated). `onTransitionStart` blocks `Cancelled → Pending` when all lines have quantity 0 (an order cancelled through Vendure's `cancelOrder`).
   - Guards (`onTransitionStart`) also: block the default transitions that make no sense for COD (`PaymentAuthorized → PaymentSettled|Modifying|ArrangingAdditionalPayment`, `Shipped → Cancelled`, `Delivered → Cancelled`; carrier problems go to `Returned`), run the `PreConfirmCheck` registry (stock warning, P6.S1) and the carrier preflight (P5.S1).
   - `OrderPlacedStrategy` returns true on entering `Pending`, so `orderPlacedAt`, `active = false`, `OrderPlacedEvent` and seller-order splitting follow Vendure semantics. Stock is already allocated one step earlier, on `ArrangingPayment → PaymentAuthorized` (default `StockAllocationStrategy`, kept).
2. **The brief's eight states**

   | Brief state | Representation |
   |---|---|
   | pending | Vendure state `Pending` (custom), entered by intake right after `PaymentAuthorized`. |
   | confirmed | `Confirmed` (custom). |
   | scheduled | `Scheduled` (custom); the callback time is `cod_order.scheduled_at`. |
   | canceled | Vendure built-in `Cancelled`, reached by transition (lines kept, stock released); restorable to `Pending`. Cancel reason/note/source are data on `cod_order`. |
   | abandoned | **No Vendure order.** Our `AbandonedCheckout` entity (P3.S4); the orders list shows it through the read model's `kind = abandoned` rows. |
   | dispatched | Vendure built-in `Shipped` (`PartiallyShipped` for a partial dispatch), reached automatically when the order's fulfilment moves to `Shipped`. A fulfilment in `Pending` means "sent to the carrier, not yet accepted"; the order stays `Confirmed` meanwhile. The UI label is "dispatched". |
   | delivered | Vendure built-in `Delivered`, reached automatically when the fulfilment moves to `Delivered`. |
   | returned | `Returned` (custom), from `Shipped`. Exchanges are linked orders/parcels (P5), not states. |
3. **Dispatch = Vendure Fulfillment**: our `CarrierFulfillmentHandler` (one handler, carrier chosen by a `carrierAccountId` argument) calls the adapter via the `dispatch` queue. The fulfilment state follows the parcel (`Pending → Shipped → Delivered`); the order follows the fulfilment through Vendure's default fulfilment process. Creating the fulfilment turns the allocation into a sale (stock on hand decreases). Undispatch cancels the fulfilment and returns the order to `Confirmed`.
4. **Payment settlement**: the COD `PaymentMethodHandler` returns `Authorized` on `createPayment`, `{ success: true }` on `settlePayment` and `cancelPayment`. On `Delivered` the COD payment is settled (the buyer paid the courier); on `Returned` it is cancelled; on `Cancelled` it stays `Authorized` (nothing was collected, and a restore needs no new payment). Settlement runs in `onTransitionEnd`; the default payment process then tries `Delivered → PaymentSettled`, which is not a legal transition and is ignored (the order stays `Delivered`). Cash moving from carrier to merchant is finance (wallets, P6.S3), not a Vendure payment. Returned goods go back to stock only when the merchant receives the parcel (P5 return processing), not automatically on `Returned`.
5. **Statuses as data**: merchant custom statuses, label statuses and tracking sub-statuses are rows (`custom_status`, colour, kind, the base state it sits on) referenced by `cod_order.custom_status_id` and `parcel.tracking_status`. They are **never** process states. Cancel reasons are rows.
6. **Order number**: a per-business gapless sequence assigned **at acceptance** (entering `Pending` at intake, or on spam release) and stored in `Order.customFields.orderNumber` + `cod_order.order_number` (unique per business), formatted `#00000001`. The counter is a row per business (P1.S1, e.g. `business_order_sequence`) incremented with `UPDATE … RETURNING` in the intake transaction, so a rolled-back intake burns no number and concurrent intakes of one business serialise on that row only. `OrderCodeStrategy` keeps Vendure's random code as the internal/tracking reference. Why not `OrderCodeStrategy`: `generate(ctx)` receives no order and runs in `OrderService.create` (state `Created`), before the quote, spam and stock checks, so a sequence there would burn numbers for every failed, spam-held or abandoned intake. The number survives cancel and restore.
7. **Customer handling**: one Vendure `Customer` per (business, phone E.164), created by intake as a guest with `CustomerService.createOrUpdate`. Vendure looks customers up by email and attaches an existing one to further channels, so the synthetic email **must be business-scoped**: `{sha256(phone)[0..16]}.{businessId}@buyers.invalid` (never emailed, no raw phone in the address). Spike B showed that with an unscoped `<phone>@buyers.invalid` the second business gets the **same** Customer row, now assigned to both channels and renamed by the second business, a cross-tenant leak. A business-wide `customer_profile` (businessId, phone) holds bans, notes and history across stores (P4.S7).
8. **Intake** (P3.S4) runs the whole flow in **one** transaction (`TransactionalConnection.withTransaction`; `OrderService.addPaymentToOrder` refuses to run outside one): customer → `OrderService.create` → lines with `quotedUnitPrice` → quote custom fields → address → shipping method → `ArrangingPayment` → assert total = quote `t` (ADR 0004) → `addPaymentToOrder(cod)` (order becomes `PaymentAuthorized`, stock allocated) → `Pending` (placed, numbered) → `cod_order` row + outbox event.
9. **COD read model `cod_order`** (owned by P3.S4, extended by P4.S1/P4.S2):
   - One row per order, written **in the same transaction** as every state change, via the `OrderStateTransitionEvent` handler inside the transaction, or explicit service calls.
   - Columns: business_id, store_id, order_id, order_number, status, custom_status_id, is_spam, assignee_id, wilaya_code, commune_ons, delivery_type, phone_e164, customer_name, item_count, total, discount_total, has_discount, offer_ids int8[], source, carrier_account_id, tracking_status, last_status_at, scheduled_at, created_at, status_since, search_text, quote_hash.
   - Dashboard lists, filters, tab counts, exports and analytics read **this** table (indexes in ADR 0016), not Vendure's channel-joined Order queries.
   - Timeline rows go to `order_event` (partitioned, ADR 0016).
10. **Events**: every transition writes an outbox row (`order.confirmed`, `order.dispatched`, …) in the same transaction (ADR 0016). Downstream effects (notifications, CAPI, webhooks, Sheets, analytics) are asynchronous.
11. **Quota masking at egress**: `cod_order.is_masked` (over-quota or expired trial, P9.S1) is checked by every consumer that sends PII out (exports, outbound webhooks, Sheets append, MCP, public API, AI prompts, notifications). PII-carrying side effects for a masked order are parked (`outbox_delivery.status = parked`) and released by `quota-cycle` on unmask.
12. **Only intake creates COD orders**: the COD `PaymentMethod` has an eligibility checker that passes only when the RequestContext carries the intake (or manual dashboard create) flag, so Vendure's Shop/Admin order mutations cannot place a COD order around the quote, spam and rate-limit checks (ADR 0008).

## Consequences

### Positive
- Keeps Vendure semantics (placed, allocation, fulfilment, payment) while COD statuses stay flexible; no core edits, one default check disabled.
- List and filter performance no longer depends on Vendure's join shape.
- Custom statuses cost no code.

### Negative
- Two representations (Vendure Order + `cod_order`) must be kept in sync transactionally. A consistency checker job compares samples nightly and alerts on drift.
- Cancel/restore stock bookkeeping is ours (release/re-allocate hooks), because Vendure's own cancel path is not restorable.
- Vendure's default transitions are merged, not replaced, so the COD guard list in 1 must be kept in step with Vendure minors (M.S1 checks `getNextOrderStates` per state against a snapshot test).

### Risks
- **Order edits after placement** (agent upsell P4.S3, line edits) were not exercised. Vendure's `modifyOrder` requires the `Modifying` state, whose default exits do not include our custom states; P4.S3 must add `Pending|Scheduled|Confirmed → Modifying → (back)` or re-price without `Modifying`, and prove it with a spike-B-style test.
- **Spam hold → release** gets the number at release; intake for held orders must stop before `Pending` (P3.S4 decides whether a held submission is an `AddingItems` order or not an order at all).

## Evidence

Spike B, 2026-11-07, same scratch app and run as ADR 0004 Evidence (`%TEMP%\p0s2a\spike-b`, SQLite because Docker was unavailable; never committed). Script `src/spike-b.ts`, `MONEY_PRECISION=0`; `CANCEL_CHECK=on` re-runs with the default `checkAllItemsBeforeCancel`.

**Code** (excerpts, `src/plugins/cod-spike/cod-spike.plugin.ts`):
```ts
declare module '@vendure/core/dist/service/helpers/order-state-machine/order-state' {
    interface CustomOrderStates { Pending: never; Confirmed: never; Scheduled: never; Returned: never }
}
export class PlaceOnPendingStrategy implements OrderPlacedStrategy {
    shouldSetAsPlaced(ctx, fromState, toState) { return toState === 'Pending'; }
}
export const codPaymentHandler = new PaymentMethodHandler({ code: 'cod', args: {}, /* … */
    createPayment: (ctx, order, amount) => ({ amount, state: 'Authorized', transactionId: `cod-${order.code}` }),
    settlePayment: () => ({ success: true }), cancelPayment: () => ({ success: true }) });
// codOrderProcess.transitions as in Decision 1; onTransitionEnd:
//   → Pending (first time): UPDATE channel SET "customFieldsOrderseq" = "customFieldsOrderseq" + 1 WHERE id = ? RETURNING …
//   → Cancelled: stockMovementService.createReleasesForOrderLines(ctx, lines)
//   Cancelled → Pending: stockMovementService.createAllocationsForOrderLines(ctx, lines)
//   → Delivered: orderService.settlePayment(ctx, codPayment.id);  → Returned: orderService.cancelPayment(ctx, codPayment.id)
config.orderOptions.process = [configureDefaultOrderProcess({ checkAllItemsBeforeCancel: false }), codOrderProcess];
```
The spike counter was per channel (one store per business); production uses a per-business row (Decision 6).

**Happy path** (stock per variant shown as onHand/allocated; both variants start at 10/0):

| Step | Result |
|---|---|
| `OrderService.create` | code `V8E2W383LWVY2Z8M` already set (state `Created`) |
| `addPaymentToOrder` (COD) | order state `PaymentAuthorized`, payment `Authorized` 9 100, stock 10/2 and 10/1 |
| `→ Pending` | `state=Pending`, `orderPlacedAt` set, `active=false`, `orderNumber #00000001`, `totalWithTax 9100`, tax 0 |

**Transitions** (each `OK`/`BLOCKED` is the `transitionToState` result):

| Transition | Result | Side effects |
|---|---|---|
| `Pending → Shipped` | BLOCKED `message.cannot-transition-order-from-to` | none |
| `Pending → Delivered` | BLOCKED (same) | none |
| `Pending → Scheduled → Pending` | OK, OK | payment stays `Authorized`, stock unchanged |
| `Pending → Confirmed` | OK | — |
| `createFulfillment` (`cod-stub-carrier`) | fulfilment `Pending`, tracking `TRK-V8E2W383LWVY2Z8M`, order stays `Confirmed` | stock 8/0 and 9/0 (allocation → sale) |
| fulfilment `→ Shipped` | order auto `Confirmed → Shipped` | — |
| fulfilment `→ Delivered` | order auto `Shipped → Delivered` | hook `payment 1 settle -> Settled`; order stays `Delivered` |
| `Pending → Confirmed → Cancelled` (transition, check off) | OK | hook `released 2 allocation(s)`; lines `[2,1]` kept, total 9 100; payment `Authorized` |
| `Cancelled → Pending` | OK | hook `re-allocated 2 line(s)`; `orderNumber` still `#00000002` |
| `Confirmed → Cancelled` with `CANCEL_CHECK=on` | BLOCKED `message.cannot-transition-unless-all-cancelled` | — |
| `cancelOrder()` from `Pending` (Vendure-native) | OK, `Cancelled` | lines `[0,0]`, total 600, allocation released by Vendure, payment `Authorized` |
| `Cancelled → Pending` after `cancelOrder()` | BLOCKED by our guard (`cannot restore an order whose lines were cancelled`); without the guard (first run) it was **allowed** and produced a `Pending` order with no lines and total 600 | — |
| `Confirmed → Shipped → Returned` | OK | hook `payment 4 cancel -> Cancelled`; stock not returned to on-hand (6/2, 8/1 unchanged) |

`getNextOrderStates` after merging: `Pending` → `Scheduled, Confirmed, Cancelled`; `Scheduled` → `Pending, Confirmed, Cancelled`; `Confirmed` → `Pending, Cancelled, PartiallyShipped, Shipped`; `Shipped` → `PartiallyDelivered, Delivered, Cancelled, Modifying, Returned`; `Delivered` → `Cancelled`; `Cancelled` → `Pending`. The default exits listed here are the ones Decision 1 guards.

**Order number**: store A orders numbered `#00000001`…`#00000005` in intake order, store B's first order `#00000001`; channel counters after the run: `store-101` 5, `store-202` 1. `OrderCodeStrategy.generate(ctx: RequestContext): string | Promise<string>` (`config/order/order-code-strategy.d.ts:42`) gets no order.

**Two businesses, same phone** `+213555123456`:
```
B order {"number":"#00000001","total":9100,"customerId":2,"email":"e5cb565881c669f9.202@buyers.invalid"}
Customer rows with phone [{"id":1,"email":"e5cb565881c669f9.101@buyers.invalid","channels":["__default_channel__","store-101"]},
                          {"id":2,"email":"e5cb565881c669f9.202@buyers.invalid","channels":["__default_channel__","store-202"]}]
UNSCOPED email contrast {"idInA":3,"idInB":3,"same":true,"nameNow":"Y B","channels":["__default_channel__","store-101","store-202"]}
```
Two distinct Customer rows with the business-scoped email; one shared, overwritten row with the unscoped one. (Every Customer is also joined to the default channel, as Vendure does for all channel-aware entities.)

**Not verified here**: `Modifying` round trips, `PartiallyShipped`/`PartiallyDelivered` with two fulfilments, concurrency of the order-number counter on Postgres, behaviour through the Admin API resolvers (the script calls services directly).

### Addendum: P0.S2a-2 re-run on Postgres (2026-11-07)

Spike B was rebuilt from the excerpts above (the original code was never committed) and re-run on **Postgres 17** (Arch Linux, native Docker, Node 24.22.1, `@vendure/core` 3.8.1, `pg` 8.23.1), database `spikeb`, scratch app outside the repo. The order-number counter is the per-business row of Decision 6 (`business_order_sequence(business_id PK, last)`, `UPDATE … SET last = last + 1 WHERE business_id = $1 RETURNING last` inside the intake transaction), not the per-channel custom field of the SQLite run.

- **Happy path:** identical to the SQLite run: `state=Pending`, `totalWithTax 9100` (raw DB value 9100, precision 0), tax 0, `orderPlacedAt` set, stock 10/2 and 10/1, proration −278/−222, `orderNumber #00000001`.
- **Transition table:** every row above reproduced, including the final stock 6/2 8/1 and the `CANCEL_CHECK=on` block. Two details:
  - `getNextOrderStates('Shipped')` returns `Delivered` twice (Vendure 3.8.1 merges our `Shipped → [Delivered, Returned]` with the default without de-duplicating). P4.S2 lists only `Returned` as our addition for `Shipped`, and the M.S1 snapshot test de-duplicates.
  - After Vendure's `cancelOrder()` (lines at quantity 0, stock already released by Vendure), our `→ Cancelled` hook must skip zero-quantity lines so stock is never released twice.
- **Same phone, two businesses:** two Customer rows with the business-scoped email, one shared and renamed row with the unscoped one, as in the SQLite run.
- **Counter concurrency (new):** business A ran 200 intakes plus 20 that throw after taking a number (20 in parallel), and business B ran 25 intakes (5 in parallel) alone, during A's load and after it. TypeORM pool `extra.max = 30`, because 25 concurrent transactions exceed node-postgres's default of 10. Same result in 3 runs: per business the numbers are exactly 1..N, with 0 duplicates and 0 gaps. Rolled-back intakes burned no number; there were 0 deadlocks, 0 serialization errors and 0 retries. A sample from the last run: business 101 numbered 1..204, business 202 numbered 1..76.
- **Where one business's burst actually waits:** Postgres session sampling, one sample per second during A's load:

  | Count | Wait | Statement |
  |---|---|---|
  | 890 | `Lock/tuple` | Vendure `StockLevelService` `SELECT … FOR UPDATE` on the stock row |
  | 114 | `Lock/transactionid` | the same statement |
  | 16 | `IO/WalSync` | `COMMIT` |
  | 0 | — | any wait on `business_order_sequence` |

  So intakes of one business buying the **same variant** serialise on Vendure's stock-level row lock, which is taken at `ArrangingPayment → PaymentAuthorized` and held until commit. Decision 6's "serialise on that row only" is true for the counter but not the first queue a hot product hits. Intakes of different businesses never waited on each other's rows (B's latency rose only from shared CPU and disk). On a loaded single-disk dev host, A's p95 was 14–144 s under a 20-way burst on one variant, so absolute numbers are not representative. **Consequence for P3.S4:** keep the intake transaction short; take the order number and do the stock allocation last, just before commit; and load-test a single-product flash sale in P3.S5.
