# ADR-0009: COD order lifecycle on Vendure

**Date**: 2026-11-07
**Status**: Proposed (draft for P0.S2a; spike B confirms)
**Deciders**: architect (draft), user

## Context

- COD statuses: pending → confirmed / scheduled (callback) / canceled, plus abandoned, merchant custom statuses and delivery/payment sub-statuses. Dispatch goes to a carrier, then tracking statuses, then delivered/returned, and exchanges are linked parcels [DM "Order (dashboard)"; feature-inventory §3, §5].
- Spam-held submissions are not orders yet. They get a number only on release [DM "Spam hold"; P3.S4].
- Vendure: `orderOptions.process: [defaultOrderProcess, custom]`, `OrderPlacedStrategy`, `OrderCodeStrategy`, `PaymentMethodHandler` (COD returns `Authorized`, settle later), `FulfillmentHandler` [VN §10].
- The order list filters on about 14 dimensions with tab counts [feature-inventory §3]. At Scale that is about 73 M orders per year (infrastructure.md).

## Options

1. **Replace Vendure's default process entirely with our states**: we lose Vendure semantics that plugins and the dashboard rely on (placed, stock allocation, fulfilment). Rejected.
2. **Keep Vendure states only and track COD status purely in our own table**: the two state machines drift apart. Rejected.
3. **Extend the default process with a small set of COD states, keep fine-grained and merchant-defined statuses as data, and project into a COD read model (recommended).**

## Decision

1. **Process** (`codOrderProcess` added after `defaultOrderProcess`):
   - `AddingItems → ArrangingPayment`: intake adds lines at quoted prices (ADR 0004) and a `cod` payment.
   - The `CodPaymentHandler.createPayment` returns `Authorized`. Then `ArrangingPayment → PaymentAuthorized → Pending`.
   - `OrderPlacedStrategy` marks the order placed on entering `Pending`, so stock allocation and `orderPlacedAt` follow Vendure semantics.
   - Custom states: `Pending`, `Confirmed`, `Scheduled`, `Returned`. Allowed transitions: `Pending ↔ Scheduled`, `Pending|Scheduled → Confirmed`, `Confirmed → Pending` (restore), `Pending|Scheduled|Confirmed → Cancelled`, `Confirmed → PartiallyShipped|Shipped` (dispatch), `Shipped → Delivered|Returned`, `Cancelled → Pending` (restore, permission-gated).
   - Guards (`onTransitionStart`) run the `PreConfirmCheck` registry (stock warning, P6.S1) and the carrier preflight (P5.S1).
2. **Dispatch = Vendure Fulfillment**: our `CarrierFulfillmentHandler` (one handler, carrier chosen by `carrierAccountId` argument) calls the adapter via the `dispatch` queue. The fulfilment state follows the parcel (`Pending → Shipped → Delivered`). Undispatch cancels the fulfilment and returns the order to `Confirmed`.
3. **Payment settlement**: on `Delivered` the COD payment is settled (`settlePayment`), because the buyer paid the courier. Cash moving from carrier to merchant is finance (wallets, P6.S3), not a Vendure payment. On `Returned` the payment is cancelled.
4. **Statuses as data**: merchant custom statuses, label statuses and tracking sub-statuses are rows (`custom_status`, colour, kind) referenced by `cod_order.custom_status_id` and `parcel.tracking_status`. They are **never** process states. Cancel reasons are rows.
5. **Abandoned checkouts**: own entity `AbandonedCheckout` (P3.S4), never a Vendure order. The orders list shows them through the read model's `kind = abandoned` rows.
6. **Order number**: the per-business gapless sequence (P1.S1) is assigned **at acceptance**, at intake or on spam release, and stored in `Order.customFields.orderNumber` + `cod_order.order_number` (unique per business). `OrderCodeStrategy` keeps Vendure's random code as an internal reference [VN §10].
7. **Customer handling**: one Vendure `Customer` per (business, phone E.164) created by intake as a guest. Vendure looks customers up by email and attaches an existing one to further channels, so the synthetic email **must be business-scoped**: `{sha256(phone)[0..16]}.{businessId}@buyers.invalid` (never emailed, no raw phone in the address). With `<phone>@buyers.invalid` the same Customer row (name, addresses) would be shared and editable by every business the buyer ordered from, a cross-tenant leak. A business-wide `customer_profile` (businessId, phone) holds bans, notes and history across stores (P4.S7). A two-business test asserts that the same phone produces two Customer rows.
8. **COD read model `cod_order`** (owned by P3.S4, extended by P4.S1/P4.S2):
   - One row per order, written **in the same transaction** as every state change, via the `OrderStateTransitionEvent` handler inside the transaction, or explicit service calls.
   - Columns: business_id, store_id, order_id, order_number, status, custom_status_id, is_spam, assignee_id, wilaya_code, commune_ons, delivery_type, phone_e164, customer_name, item_count, total, discount_total, has_discount, offer_ids int8[], source, carrier_account_id, tracking_status, last_status_at, scheduled_at, created_at, status_since, search_text, quote_hash.
   - Dashboard lists, filters, tab counts, exports and analytics read **this** table (indexes in ADR 0016), not Vendure's channel-joined Order queries.
   - Timeline rows go to `order_event` (partitioned, ADR 0016).
9. **Events**: every transition writes an outbox row (`order.confirmed`, `order.dispatched`, …) in the same transaction (ADR 0016). Downstream effects (notifications, CAPI, webhooks, Sheets, analytics) are asynchronous.
10. **Quota masking at egress**: `cod_order.is_masked` (over-quota or expired trial, P9.S1) is checked by every consumer that sends PII out (exports, outbound webhooks, Sheets append, MCP, public API, AI prompts, notifications). PII-carrying side effects for a masked order are parked (`outbox_delivery.status = parked`) and released by `quota-cycle` on unmask.
11. **Only intake creates COD orders**: the COD `PaymentMethod` has an eligibility checker that passes only when the RequestContext carries the intake (or manual dashboard create) flag, so Vendure's Shop/Admin order mutations cannot place a COD order around the quote, spam and rate-limit checks (ADR 0008).

## Consequences

### Positive
- Keeps Vendure semantics (placed, fulfilment, payment) while COD statuses stay flexible.
- List and filter performance no longer depends on Vendure's join shape.
- Custom statuses cost no code.

### Negative
- Two representations (Vendure Order + `cod_order`) must be kept in sync transactionally. A consistency checker job compares samples nightly and alerts on drift.

### Risks
- **Default-process guards** (e.g. a payment required before leaving ArrangingPayment) may need a strategy override. Spike B proves the exact path without editing core.
