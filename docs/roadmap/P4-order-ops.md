# P4 — Order operations

**Phase goal:** call-centre workflow: statuses, actions, lists, detail, assignment, spam, customers.

**Exit criteria:** Full confirm/cancel/schedule/custom-status loop works with timeline; orders auto-assigned; spam holds and rules work; customers can be banned.

**Session order and lanes** (all start after P3.S4 is merged)
- Lane 1: **P4.S1** (order state machine) first. After it merges, **P4.S2**, **P4.S3**, **P4.S4** can run in parallel (P4.S3 also needs P2.S5; P4.S4 also needs P1.S4).
- Lane 2: **P4.S5** (spam engine) starts right after P3.S4, in parallel with P4.S1–S4; then **P4.S6** (rule builder) and **P4.S7** (customers; needs P4.S1 and P4.S5) in parallel.
- Shared files touched only by appending a registration line: `apps/server/src/vendure-config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/events/index.ts`, dashboard nav registration, and the `plugins/order-ops` plugin module file (P4.S2 and P4.S3 each append their providers/routes; keep both lines on conflict).
- Event names (first emitter defines them in `packages/shared/events`): OrderStatusChanged, OrderConfirmed, DeviceTrusted (P4.S1); `OrderPlaced` already exists from P3.S4.
- Cross-session contracts to respect (README "Shared contracts"): P4.S1 owns status transitions, the `PreConfirmCheck` registry and the `mark-spam` action (stub flag until P4.S5 lands the spam engine); **P4.S5 owns the block list (`SpamBlock`) and the `/orders/ban` + `/orders/unban` endpoints**; P4.S7 builds the customer block dialog, cancel-unshipped and the `isBanned` projection on top of them; P4.S3's "Ban customer" button calls the P4.S5 endpoints behind a capability flag and stays hidden until P4.S5 and P4.S7 are merged.

Brief format: [_session-template.md](_session-template.md). Rules: [CONTRIBUTING.md](CONTRIBUTING.md). Own branding only: never use the name, logo, theme names or copy of the reference product; clone behaviour only.

---

## P4.S1 — Order state machine & actions

| Field | Value |
|---|---|
| **Goal** | Implement the COD order lifecycle as a Vendure OrderProcess with status history and timeline, plus the confirm/cancel/restore/schedule/custom-status/duplicate/spam/trust actions and their settings. |
| **Branch** | `feat/p4-s1-order-states` |
| **GitHub issue** | `P4.S1 Order state machine & actions` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P3.S4 merged |
| **Parallel-safe** | Yes, with P4.S5. Owns `plugins/order-ops/**` (state machine, actions, settings, comments), `packages/shared/src/orders/**`, `packages/shared/src/events/order-status.ts`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered**
- Statuses: Pending, Confirmed, Scheduled (callback), Canceled, Abandoned + merchant custom statuses; delivery and payment sub-statuses
- Timeline of status changes with time spent in each stage (data; UI in P4.S3)
- Internal comments on orders (API; UI in P4.S3)
- More actions: set custom status, schedule (callback date), exchange order (linked second parcel), add discount, duplicate order, trust this device, cancel with reason (actions here; menu UI in P4.S3; exchange → P5.S3)
- Cancel reasons (coloured, optional required note, suggested set)
- Order states and actions: confirm, dispatch (with failure taxonomy), schedule callback, custom status, cancel with numbered reasons + note, restore, duplicate (prefill + recalculated total), mark as spam (dispatch → P5.S1)
- Cancel reasons seed set (7 Arabic reasons), "require a reason" toggle; custom status with colour; label statuses for tracking (label statuses data model here; tracking use → P5.S2)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P3.S4 (the minimal `Pending` process to extend, `cod_order` read model), P1.S6 (outbox, partition helper), P1.S3 (permissions: confirm, cancel, schedule, comment, give discount); ADR 0009 (order lifecycle on Vendure: states vs custom statuses, payment/fulfillment handling, §8 read model, §9 events), ADR 0016 (outbox, partitioning)
- `docs/architecture/system-design.md` §2.6 (dashboard confirm → dispatch), §5 (data)
- `docs/research/second-pass.md` → "Other order actions (performed)" (full action/API table and per-state menu), "Status settings (performed)", "Storefront order → delivered" steps 4–5
- `docs/research/data-model.md` → "Order (dashboard)" (`status`, `statusColor`, `statusSince`, `statusHistory`, `cancelReason`, `cancelNote`, `cancelSource`, `scheduledDate`)
- `docs/research/api-surface.md` → "Orders", "Added in the second pass" (confirm/cancel/schedule/comments/duplicate/mark-spam, `/cancel-reasons`, `/custom-status`)

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #208 CO-7 (low): test(server): tune query complexity limits on real list pages

**High-level plan**
1. Shared status catalogue + `OrderStatusChanged`/`OrderConfirmed` events and payloads → commit `feat(shared): order status catalogue and events`
2. Custom Vendure `OrderProcess` per ADR 0009 (extending P3.S4's minimal process; no core edits): states pending, confirmed, scheduled, canceled, abandoned, dispatched, delivered, returned; merchant custom statuses are **data** (a per-business label on top of a state), never process states; legal transitions table; `statusHistory` with `{date, status, duration}` and `statusSince`; emit events. Cancel per ADR 0009: Vendure's built-in `cancelOrder()` zeroes line quantities and releases stock, so restore (cancelled → pending) needs our guard that re-applies the quantities, the default `checkAllItemsBeforeCancel` check is disabled, and our `→ Cancelled` hook skips zero-quantity lines so stock is never released twice (ADR 0009 addendum); `getNextOrderStates('Shipped')` returns `Delivered` twice in 3.8.1, so de-duplicate it → commit `feat(order-ops): cod order process and status history`
3. Settings entities and CRUD: `CancelReason` (name, color, askForNote, archived, "use suggested" seeds the 7 Arabic reasons), `requireReason` toggle, `CustomStatus` (`kind` order|label, name, description, color from 9 named colours, isActive), per-reason order counts → commit `feat(order-ops): cancel reasons and custom statuses`
4. Actions API (REST + GraphQL): `POST /orders/confirm/:id`, `/orders/cancel/:id {cancelReasonId?, note?}`, `PATCH /orders/:id {status}` (restore → pending, custom status by name), `POST /orders/schedule/:id {scheduleDate}`, trust-device action (sets the order flag and emits `DeviceTrusted`; P4.S5 persists the `TrustedDevice`), mark-spam (sets `isSpam`; spam engine hook for P4.S5) → commit `feat(order-ops): order actions`
5. Timeline and comments: `OrderEvent` log (status changes, edits with audit diff before/after, assignment events placeholder), `/orders/:id/comments` CRUD with permissions → commit `feat(order-ops): timeline and comments`
6. Duplicate: `GET duplicate-prefill` (copy client/items/agent, recalculated total via `PricingService.quote()`, original vs calculated) and `POST /orders/:id/duplicate`; `PreConfirmCheck` registry: providers return `ok | warn{message, lines[]} | block{reason}`, run by confirm and exposed as `GET /orders/:id/pre-confirm` for the dialog (P6.S1 registers the stock check) → commit `feat(order-ops): duplicate order and pre-confirm checks`
7. Dashboard: Settings → Status customization (custom statuses table, label-status toggle, cancel-reason list with "Use suggested reasons" and "Require a reason" toggle) → commit `feat(order-ops): status customization ui`
8. Maintain the cod_order read model and order_counter in the same transaction as every transition (they are the only source for merchant order lists, tab counts, filters and exports; Vendure's own order list stays staff-only, ADR 0002, 0009 §9); write timeline rows to the partitioned order_event table (P1.S6 partition helper); outbox event per transition (ADR 0009/0016) → commit `feat(order-states): read model, timeline partitions and outbox events`

**Deliverables:** `plugins/order-ops` (process, entities, services, REST/GraphQL, `PreConfirmCheck` registry documented in the handoff, settings screen), migrations, events in `packages/shared`.

**Acceptance criteria**
- [ ] Only legal transitions succeed (e.g. delivered → pending is refused); every transition appends `statusHistory` with the duration of the previous stage.
- [ ] Confirm sets `confirmedAt`, emits `OrderConfirmed` and `OrderStatusChanged`; confirming twice is idempotent.
- [ ] Cancel with no reasons configured cancels instantly ("No reason given"); with "require a reason" on, a missing reason returns 422; a reason flagged ask-for-note requires a note; cancelled orders can be restored to pending with their original line quantities, and stock is released exactly once per cancel (ADR 0009).
- [ ] "Use suggested reasons" creates the 7 Arabic reasons exactly once and shows per-reason order counts.
- [ ] Schedule stores `scheduledDate`, status `scheduled`, and the order appears in the Callbacks filter set (query support).
- [ ] Setting a custom status by name works and shows its color; label-status kind is stored but not shown to customers.
- [ ] Duplicate prefill returns original vs recalculated total and carries the delivery agent; posting creates a new pending order with a new number.
- [ ] Comments are visible to staff only, permission-gated (comment / delete comments).
- [ ] A test `PreConfirmCheck` returning `warn` surfaces in the confirm response without blocking; one returning `block` refuses the confirm with its reason; with no providers registered confirm behaves as before.
- [ ] All actions are refused without the matching permission and write an audit event.
- [ ] A nightly read-model consistency check over 10k seeded orders reports 0 drift after a randomised transition run.

**Verification**
- Unit: transition table (all pairs), duration calculation, reason validation matrix. Integration: each action endpoint with permission allow/deny; event emission counts. 
- Browser: Status customization screen vs `dashboard-captures.md` "Store settings → Status customization" and `second-pass.md` "Status settings"; drive confirm/cancel/schedule via API with the admin shell.
- Multi-tenant: actions on business B's order id from business A's session return 404; reasons and statuses are per business.

**Out of scope:** order list/detail UI (P4.S2/S3), dispatch and tracking transitions beyond state definitions (P5.S1/S2), real spam engine (P4.S5), stock warning logic (P6.S1), exchange (P5.S3).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S1 "Order state machine & actions" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s1-order-states from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P4.S2 — Orders list, filters, bulk & export

| Field | Value |
|---|---|
| **Goal** | The call-centre orders list: tabs with counts, KPI strip, every filter, search, pagination, row actions, bulk actions and the export dialog. |
| **Branch** | `feat/p4-s2-orders-list` |
| **GitHub issue** | `P4.S2 Orders list, filters, bulk & export` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P4.S1 merged |
| **Parallel-safe** | Yes, with P4.S3, P4.S4, P4.S5, P4.S7. Owns `plugins/order-ops/src/list/**` and `plugins/order-ops/dashboard/orders-list/**`, `plugins/order-ops/src/export/**`. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered**
- Orders list: tabs All / To confirm / Callbacks / Ready to ship with counts; search by number, customer, phone, product; pagination
- Filters: store, status, stock (short on stock), date presets + range, wilaya, product/variant, assignee, delivery type, duplicates, offer, promo code, has discount, item count
- Row actions: call, confirm, edit, inline status change, returning badge
- Bulk: change status, assign, dispatch to carrier, export (dispatch button disabled until P5.S1)
- Export dialog: all / this page; templates Everything / Delivery sheet / Accounting; Excel / CSV — `/orders/export`

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P4.S1 (statuses, actions, read model), P3.S4 (attribution fields, `cod_order`, `order_counter`); ADR 0016 §4 (list indexes, keyset pagination)
- `docs/research/dashboard-captures.md` → "Orders `/orders`" (buttons, tabs, filters, columns, export and Change Status dialogs)
- `docs/research/data-model.md` → "Order (dashboard)" (list response and `pagination{}` shape)
- `docs/research/api-surface.md` → "Orders" (`/orders` query params, `/orders/bulk`, `/orders/export`, `excludedStatuses`)
- `docs/research/second-pass.md` → "Home after activity" (deep-link targets `tab=to-confirm`, `tab=ready`)

**High-level plan**
1. List query service reading **only** `cod_order` / `cod_order_item` + `order_counter` (never Vendure's `Order` list query: spike C took 2.6 s cold on a large store, ADR 0002, 0009 §9): filters (all listed), tab predicates (to-confirm = pending; callbacks = scheduled; ready = confirmed, not dispatched), search per ADR 0014 (exact B-tree match on `order_number` and `phone_e164` first, then `word_similarity` on the normalised `cod_order.search_text` built by the shared `normalizeForSearch()` from `packages/shared`; not Vendure's `DefaultSearchPlugin`), sort, pagination `{page, limit, totalCount, totalPages, hasNextPage, hasPreviousPage}`, per-tab counts, `excludedStatuses` → commit `feat(order-ops): orders list query`
2. KPI strip + "returning N" badge data (prior orders by phone) + duplicate flag query → commit `feat(order-ops): list kpis and returning badge`
3. Dashboard list screen: tabs, filters bar, date presets (24h, 7/30/90 days, 1 year, range), search, page size 20, selection, columns Order Number/Customer/Items/Delivery/Status/Assignee/Total/Actions; URL-synced filters and deep links → commit `feat(order-ops): orders list ui`
4. Row actions: call link, Confirm, Edit link, inline status pill menu (uses P4.S1 actions incl. cancel-reason dialog) → commit `feat(order-ops): row actions`
5. Bulk bar: Change Status dialog (Confirmed, Cancelled, custom), Assign dialog (uses assignment service when present, else manual field), Dispatch button disabled with tooltip until carriers exist → commit `feat(order-ops): bulk actions`
6. Export: async job reading `cod_order` (keyset batches) and writing the file to the private bucket in Algerian object storage (MinIO, presigned 1 h download; never R2, ADR 0011/0012), producing xlsx/csv, scopes All/This page, templates Everything/Delivery sheet/Accounting with column sets in `packages/shared` → commit `feat(order-ops): orders export`
7. Index set from ADR 0016 §4 via CONCURRENTLY migrations; keyset pagination (created_at desc, id desc); tab counts from order_counter; every filter validated with EXPLAIN (ANALYZE, BUFFERS) on a 5 M-order seed (results in the PR) → commit `perf(orders-list): indexes, keyset pagination and counters`

**Deliverables:** GraphQL/REST list + counts + bulk endpoints, export job and download endpoint, dashboard list route `/orders`.

**Acceptance criteria**
- [ ] Tab counts equal the number of rows each tab returns with no other filters; counts update after an action.
- [ ] Every filter narrows results correctly and combines with others; filters survive reload via the URL.
- [ ] Search matches order number, customer name, phone and product name, including Arabic spelling variants (hamza, ة/ه, ى/ي, "ال") through the shared normaliser.
- [ ] No merchant list, count, filter or export path queries Vendure's `Order` list (test/grep check); export files land in the private Algerian bucket.
- [ ] A customer with 2 earlier orders shows "Returning · 2".
- [ ] Inline status change and Confirm update the row without a full reload; cancel opens the reason dialog when reasons exist.
- [ ] Bulk Change Status applies to all selected, reports successes and failures, and respects per-order permission.
- [ ] Export "Delivery sheet" contains name, phone, wilaya, commune, address, total COD amount; "Accounting" contains totals/discounts/shipping; CSV and xlsx both open; "This page" exports only the visible page.
- [ ] Phone numbers of masked orders (`isMasked`) are never exported or shown.
- [ ] Every list filter combination in the brief returns page 1 in < 300 ms p95 on the 5 M-order seed; tab counts do not use COUNT(*).

**Verification**
- Unit: filter-to-query builder, tab predicates, export column mapping. Integration: list endpoint with seeded 120 orders across statuses (counts, pagination, each filter), bulk endpoint, export file content.
- Browser: list screen vs `dashboard-captures.md` "Orders `/orders`" (tabs, filters, columns, dialogs); screenshots.
- Multi-tenant: list, counts, bulk and export for business A never include B's orders, even with forged ids in bulk.

**Out of scope:** detail page (P4.S3), assignment logic (P4.S4), real dispatch (P5.S1), Google Sheets export (P9.S5).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S2 "Orders list, filters, bulk & export" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s2-orders-list from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P4.S3 — Order detail, create/edit & agent upsell

| Field | Value |
|---|---|
| **Goal** | Order detail page, manual order creation, order editing and the agent upsell panel that switches the order to a better offer tier with an audit diff. |
| **Branch** | `feat/p4-s3-order-detail` |
| **GitHub issue** | `P4.S3 Order detail, create/edit & agent upsell` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P4.S1, P2.S5 merged |
| **Parallel-safe** | Yes, with P4.S2, P4.S4, P4.S5, P4.S7. Owns `plugins/order-ops/dashboard/order-detail/**`, `plugins/order-ops/dashboard/order-create/**`, `plugins/order-ops/src/edit/**`, `plugins/order-ops/src/upsell/**`, `plugins/order-ops/src/custom-fields/**`. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered**
- Create order manually: product/variant picker with qty, customer dialog (name, phone, wilaya, commune, address, home/stopdesk), notes — `/orders/create`
- Order detail: items, subtotal/shipping/total, delivery + payment status pills — `/orders/:id`
- Timeline of status changes with time spent in each stage (UI; data from P4.S1)
- Internal comments on orders (UI; API from P4.S1)
- Buyer record on order (orders / delivered / returned by phone), link to customer, edit contact, ban customer — `/orders/client-history?phone` (ban button calls the P4.S5 `/orders/ban` endpoint; flagged until P4.S5 and P4.S7 are merged)
- Assignment panel: assignee, how assigned (auto/manual), assignment history (display; engine in P4.S4)
- Parcel opening allowed / not (per carrier setting) (display only; setting source P5.S1)
- Order source attribution (display; capture was P3.S4)
- More actions: … (menu by order state; actions from P4.S1; exchange → P5.S3)
- Custom order fields — `/orders/:id/custom-fields`
- Agent upsell panel on the order page (switch to quantity-offer tier with price delta) + audit diff in timeline

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P4.S1, P2.S5 (offers), P2.S4 (`PricingService.quote()` / `repriceOrder()`), P3.S1 (shipping quote); ADR 0004 (re-pricing an existing Vendure order to quote-exact totals)
- `docs/research/dashboard-captures.md` → "Create order `/orders/create`", "Order detail `/orders/:orderId`"
- `docs/research/second-pass.md` → "Storefront order → delivered" step 4 (offers panel, audit diff "Total 5,700 → 9,620; Items ×1 → ×2"), "Other order actions" (per-state More-actions menu, duplicate prefill banner)
- `docs/research/api-surface.md` → "Orders" (`client-history`, `custom-fields`, `/orders/:id/offer-options`, `reprice-preview`, `shipping-quote`, `discounts`, `stopdesk-options`)
- `docs/research/data-model.md` → "Order (dashboard)"

**High-level plan**
1. Edit service: update items, quantities, client, delivery type, shipping price, notes with recalculation through `PricingService.repriceOrder()` (P2.S4) applied with the ADR 0004 strategy; before/after audit diff written to the timeline; blocked once dispatched → commit `feat(order-ops): order edit with audit diff`
2. Manual discount endpoints `/orders/:id/discounts` (permission "give discount") and `/orders/:id/shipping-quote`, `stopdesk-options` → commit `feat(order-ops): discounts and delivery options`
3. Upsell: `GET /orders/:id/offer-options` (current tier, next tiers with price delta and "closest offer", free-delivery tier) and `POST reprice-preview`; Switch applies via the edit service → commit `feat(order-ops): agent upsell offer options`
4. Client history: `GET /orders/client-history?phone` (counts orders/delivered/returned, latest orders), edit-contact endpoint → commit `feat(order-ops): client history and contact edit`
5. Detail page UI: header (number, Confirm/Dispatch-placeholder, Edit, More actions by state), pills, totals, items, timeline with durations and comments box, client panel, additional-information panel (assignee select, how assigned, history, parcel opening, order source), upsell panel → commit `feat(order-ops): order detail ui`
6. Create-order page: product browse dialog with variant expansion and multi-select, qty +/-, customer dialog with wilaya → commune and delivery method, notes, delivery price (auto from quote, manually overridable with `shippingPriceSource`), duplicate prefill mode (`?duplicate=`) → commit `feat(order-ops): create order page`
7. Custom order fields definition + values on order (`/orders/:id/custom-fields`), missing-field flags → commit `feat(order-ops): custom order fields`

**Deliverables:** edit/upsell/client-history/custom-field services and endpoints, dashboard routes `/orders/:id`, `/orders/create`, `/orders/:id/edit`.

**Acceptance criteria**
- [ ] Detail page shows items, subtotal, shipping, total (item count), delivery and payment pills, timeline with "time in stage", and comments (visible to staff only).
- [ ] Buyer record shows "N orders · N delivered · N returned" computed by phone across the business's stores.
- [ ] Upsell panel for a 1-piece order lists "Now: 1 piece" and tier options with the price delta ("+3,920 for this order" style) and a free-delivery option; Switch changes quantity and total and the timeline logs an audit diff of total and item quantity.
- [ ] Edit is refused (or limited to notes/assignee) once the order is dispatched; every edit shows before/after in the timeline.
- [ ] More-actions menu items match order state (pending: Schedule, Add a discount, Duplicate, Mark as spam, Cancel; delivered: adds Exchange (hidden until P5.S3), Trust this device).
- [ ] Create order: cannot submit without product, name, phone (05/06/07), wilaya, commune, address and delivery method; created order has channel `dashboard`, status pending, per-business number.
- [ ] Duplicate opens the create form prefilled with the "Copied from order #…" banner, original vs calculated total and "Use calculated total".
- [ ] Ban button is hidden unless the ban capability flag is on (P4.S5 endpoints + P4.S7 dialog merged); masked-phone orders hide the number.

**Verification**
- Unit: edit diff builder, upsell option computation (tier boundaries, free-delivery tier, no further tier), client-history counts. Integration: edit/discount/offer-options/reprice-preview endpoints, permission denies.
- Browser: detail and create pages vs `dashboard-captures.md` "Order detail" and "Create order", and the upsell scenario in `second-pass.md` step 4; screenshots.
- Multi-tenant: client-history by phone for business A never counts B's orders; editing or reading B's order id returns 404.

**Out of scope:** dispatch dialog and tracking (P5.*), assignment engine (P4.S4), ban endpoints (P4.S5) and block dialog (P4.S7), exchange (P5.S3), stock availability line "In stock · N available" (P6.S1).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S3 "Order detail, create/edit & agent upsell" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s3-order-detail from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P4.S4 — Assignment & order distribution

| Field | Value |
|---|---|
| **Goal** | Automatically assign new orders to team members by mode, reclaim stale orders, apply exception rules and product managers, and expose assignment history. |
| **Branch** | `feat/p4-s4-distribution` |
| **GitHub issue** | `P4.S4 Assignment & order distribution` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P4.S1, P1.S4 merged |
| **Parallel-safe** | Yes, with P4.S2, P4.S3, P4.S5, P4.S7. Owns `plugins/distribution/**`, `packages/shared/src/distribution/**`. |
| **Model / size** | Opus · M |
| **External needs** | None. |

**Inventory rows covered**
- Assignment panel: assignee, how assigned (auto/manual), assignment history (logic, history data and assign endpoints here; panel UI in P4.S3)
- Order distribution: Evenly (fewest open) / In turn / Nobody; reclaim timeout; exception rules (ordered) — `?tab=distribution`
- Order distribution: reclaim after N min of working hours, max hops then flag manager; exceptions by wilaya/source/total; product managers
- Filters: … assignee … (assignee filter query support for P4.S2)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P4.S1, P1.S4 (member limits, stop-receiving, working hours if any, store access)
- `docs/research/dashboard-captures.md` → "Team `/team`" (Order distribution tab: modes, "When is an order taken back?", Exceptions)
- `docs/research/api-surface.md` → "Orders" (`/orders/assignee`, `/orders/assignment-settings`, `/assignment-settings/summary`, `/orders/assignment-rules`, `/assignment-rules/:id`, `/assignment-rules/reorder`, `/employees/order-managers`)
- `docs/research/data-model.md` → "Order" (`assignee`), `docs/research/second-pass.md` → order record fields `assignmentHops`, `assignmentFlagged`, `assignmentEvents`, `lastTouchedAt/ById`

**High-level plan**
1. Entities and shared types: `AssignmentSettings` (mode, reclaimMinutes, workingHours, maxHops), `AssignmentRule` (ordered; conditions wilaya/source/total-above; target members), `AssignmentEvent`, product `orderManagers` link → commit `feat(distribution): assignment entities`
2. Assignment service: on `OrderPlaced` (or release from hold) pick assignee by mode — Evenly (fewest open orders), In turn (round-robin pointer), Nobody — honouring member store access, max-open limit and stop-receiving; apply ordered exception rules first, then product managers → commit `feat(distribution): assignment service`
3. Manual and bulk assign endpoints `/orders/assignee` with permission check; each change writes an `AssignmentEvent` (auto/manual, from, to, reason) and a timeline entry → commit `feat(distribution): manual and bulk assign`
4. Reclaim job (BullMQ): orders still untouched (`lastTouchedAt`) after N minutes counted in working hours return to the pool and hop; after `maxHops` set `assignmentFlagged` and notify manager via event → commit `feat(distribution): reclaim job and hop limit`
5. Settings API + summary (`/orders/assignment-settings`, `/summary`) and "how it got here" explanation string → commit `feat(distribution): settings and summary api`
6. Dashboard: Team → Order distribution tab (mode radios, reclaim timeout, exceptions list with add/edit/reorder/delete) → commit `feat(distribution): distribution settings ui`

**Deliverables:** `plugins/distribution`, migrations, BullMQ job, GraphQL/REST, dashboard tab, assignee filter helper consumed by P4.S2.

**Acceptance criteria**
- [ ] Evenly: with members A(2 open), B(0 open), C(1 open) the next order goes to B; In turn cycles A→B→C→A regardless of load; Nobody leaves `assignee` empty.
- [ ] Members at their max-open limit, with "stop receiving orders", inactive, or without access to the order's store are skipped.
- [ ] First matching exception rule (by order position) wins over the mode; rule order is changeable and persisted.
- [ ] A product with dedicated order managers assigns to one of them first.
- [ ] After N working-hour minutes without touch the order is reassigned (hop count +1, event logged); after max hops it is flagged and the manager is notified; outside working hours the clock does not run.
- [ ] Assignment history lists each event with actor, auto/manual and time; "how it got here" reads e.g. "Automatically: evenly".
- [ ] Manual and bulk assign override auto-assignment and are permission-gated.

**Verification**
- Unit: pure selection functions for each mode, rule matcher, working-hours clock, hop logic (deterministic with injected clock). Integration: order placed → assigned; reclaim job run; concurrency (20 simultaneous orders do not exceed a member's limit).
- Browser: Order distribution tab vs `dashboard-captures.md` "Team → Order distribution"; screenshot.
- Multi-tenant: assignment never picks a member of another business; rules and settings are per business (and per store where specified).

**Out of scope:** panel UI on the order page (P4.S3), member invitation and limits UI (P1.S4), team stats report (P7.S1), commissions payout (P6.S4).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S4 "Assignment & order distribution" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s4-distribution from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P4.S5 — Spam engine & held orders

| Field | Value |
|---|---|
| **Goal** | Hold suspicious storefront orders before they become orders, with device fingerprinting, protection levels, a held-orders UI, trust/block lists with the ban/unban endpoints, a daily summary, and duplicate detection and merge. |
| **Branch** | `feat/p4-s5-spam-engine` |
| **GitHub issue** | `P4.S5 Spam engine & held orders` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P3.S4 merged |
| **Parallel-safe** | Yes, with P4.S1–S4 (P4.S6 and P4.S7 build on it). Owns `plugins/spam/**`, `packages/shared/src/spam/**`, the `SpamBlock` store and the `/orders/ban`, `/orders/unban` endpoints. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered**
- Spam: held orders list (by order / by device) — `/orders/spam`
- Protection level Off / Standard / Strict — `S:/store_settings?tab=spam`
- Trusted team devices, allow-listed numbers, blocked devices/numbers list
- Daily summary of held orders at 20:00
- Spam engine: built-in reasons (TEST_ORDER, JUNK_PHONE…), device fingerprint and 24h velocity, held list by order/by device, "Not spam" releases into orders, "Discard and block device", 30-day expiry
- Duplicate detection and merge
- Ban / unban by phone or device — `/orders/ban`, `/orders/unban` (**endpoints and block list here**; customer UI, cancel-unshipped and `isBanned` projection in P4.S7, which ticks the row)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P3.S4 (`SpamGate` hook, deviceId, formMs), P4.S1 if merged (mark-spam, `DeviceTrusted` event); if P4.S1 is not merged yet, subscribe to the event name from `packages/shared/src/events/` and leave the "trust from an order" button for P4.S1's menu
- `docs/research/api-surface.md` → "Orders" (`/orders/ban`, `/orders/unban`), `docs/research/second-pass.md` → "Customers (with data)" (block reasons wording)
- `docs/research/data-model.md` → "Spam hold (anti-fraud)" (held payload, reason codes, device block, UI wording)
- `docs/research/dashboard-captures.md` → "Spam `/orders/spam`", "Store settings → Spam protection"
- `docs/research/second-pass.md` → "Storefront order → delivered" step 3 (release "Not spam" → order #00000001, number starts on release)
- `docs/research/api-surface.md` → "Customers & spam" (`/spam`, `/summary`, `/held`, `/settings`, `/blocks`, `/trusted-devices`)

**High-level plan**
1. Entities/types: `HeldOrder` (30-day `expiresAt`, reasons[], device snapshot), `SpamSettings` (level, summary time), `TrustedDevice` (max 50), `SpamBlock` (device|phone), `AllowedPhone`; shared reason codes → commit `feat(spam): entities and shared reason codes`
2. Device fingerprinting from request (UA parsing → os, browser, inApp, deviceType, key) and 24h velocity counters (`submissions24h`, `phones24h`, `wilayas24h`) in Redis/DB → commit `feat(spam): device fingerprint and velocity`
3. Evaluator implementing `SpamGate`: allow-list and trusted devices bypass; blocked devices/numbers rejected; built-in reasons TEST_ORDER and JUNK_PHONE `{distinctDigits}`; level Off/Standard/Strict thresholds; result accept/hold/reject; hold stores items and masked phone (`0555 •• •• 11`), no order number consumed → commit `feat(spam): evaluator and hold`
4. Held API `/spam/held` (List / By device grouping), actions: Not spam (release: create the order via intake service with next number, assigned on entering `Pending` inside the intake transaction into `Order.customFields.orderNumber`, ADR 0009, run assignment/OrderPlaced), Discard, Discard all, Discard N and block device; `/spam/summary`, `/spam/settings`, `/spam/blocks`, `/spam/trusted-devices` (+ `DeviceTrusted` subscriber); `POST /orders/ban {phone|deviceKey, reason}` and `POST /orders/unban` writing/removing `SpamBlock` rows business-wide (all stores) and emitting `CustomerBanned`/`CustomerUnbanned` for P4.S7 → commit `feat(spam): held orders, block list and ban endpoints`
5. Expiry job (purge after 30 days) and daily 20:00 summary job (store timezone) emitting a notification event hook (delivery in P7.S3) → commit `feat(spam): expiry and daily summary jobs`
6. Duplicate detection (same phone + same product within a window, flag `isDuplicate`; filter support) and merge action combining items/quantities into the oldest order with audit entry → commit `feat(spam): duplicate detection and merge`
7. Dashboard: `/orders/spam` (List / By device, device card "Windows PC · Chrome — N orders · N numbers · N wilayas", toasts "Added to your orders as #…"), Settings → Spam protection (level, trusted devices, never-hold numbers, blocked list, summary toggle) → commit `feat(spam): spam ui`

**Deliverables:** `plugins/spam`, migrations, jobs, REST/GraphQL incl. `/orders/ban` + `/orders/unban`, `CustomerBanned`/`CustomerUnbanned` events, two dashboard screens, wired `SpamGate` registration.

**Acceptance criteria**
- [ ] A storefront order named "test" with a junk phone (e.g. one distinct digit repeated) is held with reasons `TEST_ORDER` and `JUNK_PHONE {distinctDigits}`, creates no order and does not consume an order number; the buyer still sees the normal thank-you page.
- [ ] Held record matches the `Spam hold` shape: masked phone, `expiresAt = createdAt + 30 days`, device block with counts.
- [ ] "Not spam" creates a real pending order with the next business number and fires `OrderPlaced`; "Discard" removes the hold; "Discard all" clears the filtered set; "Discard N and block device" also blocks the device so its next order is refused.
- [ ] Level Off holds nothing built-in; Strict holds more than Standard on a fixed fixture set; allow-listed phone and trusted device are never held.
- [ ] Held records older than 30 days are purged by the job; the 20:00 job emits one summary event per store with the held count.
- [ ] Two orders with same phone and product within the window are flagged duplicates; merging keeps one order with combined quantities and an audit entry.
- [ ] Phone in the held list is masked for roles without the right permission.
- [ ] `POST /orders/ban {phone}` makes the next storefront submit with that phone refused in every store of the business (no order, no number consumed); `unban` restores it; both emit their event once and are permission-gated.

**Verification**
- Unit: reason evaluators, level thresholds, UA parsing table, velocity windows, merge logic. Integration: submit → hold → release/discard/block flow; jobs with fake clock.
- Browser: held list and device card vs `data-model.md` "Spam hold" UI notes and `dashboard-captures.md` "Spam"; Spam protection settings page; screenshots.
- Multi-tenant: held items, blocks and trusted devices are scoped per business/store; business A's block never refuses B's customers; "Not spam" on B's hold id from A returns 404.

**Out of scope:** the rule builder and rule evaluation (P4.S6), the customers area, block dialog, cancel-unshipped and `isBanned` projection (P4.S7; it calls the endpoints owned here), notification delivery (P7.S3).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S5 "Spam engine & held orders" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s5-spam-engine from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S5.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P4.S6 — Spam rule builder

| Field | Value |
|---|---|
| **Goal** | Let merchants build up to 25 rules (If conditions → To Spam / Flag as suspicious / Always accept) from a schema-driven UI, evaluated inside the spam engine. |
| **Branch** | `feat/p4-s6-spam-rules` |
| **GitHub issue** | `P4.S6 Spam rule builder` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P4.S5 merged |
| **Parallel-safe** | Yes, with P4.S2–S4, P4.S7. Owns `plugins/spam/src/rules/**`, `plugins/spam/dashboard/rules/**`, `packages/shared/src/spam/rules/**`. |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered**
- Rule builder with templates (schema-driven conditions) — `/settings/spam-rules/new`
- Spam rule builder: If (≤10 conditions over order fields, buyer history, device/IP/ad-click/shared-link velocity, fill time, network abroad, in-app browser) Then To Spam / Flag as suspicious / Always accept; ≤25 rules

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P4.S5 (evaluator extension points, velocity counters, device fields)
- `docs/research/data-model.md` → "Spam rules" (limits, all fields with ops and value types, thresholds, built-in reasons)
- `docs/research/dashboard-captures.md` → "Store settings → Spam protection" ("Your rules" + "Start from a ready-made rule" → `/settings/spam-rules/new?template&store`)
- `docs/research/api-surface.md` → "Customers & spam" (`/spam/rules`, `/spam/rules/schema`)

**High-level plan**
1. Shared schema module: fields, groups, ops, value types and limits exactly as in data-model.md (`maxRules 25`, `maxConditions 10`, `maxListValues 500`, `nameMax 60`, …) + zod validators → commit `feat(spam): rule schema and limits`
2. `GET /business/:bid/spam/rules/schema` and rule CRUD (`/spam/rules`) with validation (phone prefix min 4 chars, province 1–58, `ip_orders` cannot hold, etc.) and ordering → commit `feat(spam): rule crud and schema endpoint`
3. Evaluation inside the engine: compile conditions to predicates over intake payload + buyer history (delivered/returned counts by phone) + device velocity (`device_orders`, `device_phones`, `device_ad_clicks`, `shared_link`, `ip_orders`), fill time, network abroad, in-app browser; actions To Spam (hold, reason `RULE {ruleId}`), Flag as suspicious (order created with `riskLevel`/`riskReasons`), Always accept (overrides built-in holds) → commit `feat(spam): rule evaluation`
4. Rule-quality hints from thresholds (`thinOrders`, `minDecided`, `minMatchedForShare`, `deliveredShare`, `broadShare`): backtest a rule against past orders and warn when too broad or when it would catch mostly delivered orders → commit `feat(spam): rule quality hints`
5. Templates ("ready-made rules") list and UI at `/settings/spam-rules/new?template=&store=`: condition rows with field/op/value editors per value type, add up to 10, action picker, name, unsaved-changes bar, Save; rules list in Spam protection settings with enable/reorder/delete → commit `feat(spam): rule builder ui`

**Deliverables:** schema + CRUD endpoints, evaluator extension, backtest service, builder screen and templates.

**Acceptance criteria**
- [ ] Schema endpoint returns groups (order, history, identity), fields, ops and limits identical to the documented list; the UI renders only from it (adding a field in the schema shows it without UI code).
- [ ] 26th rule, 11th condition, name over 60 chars, list over 500 values or a phone prefix under 4 characters are rejected with a clear message.
- [ ] Rule "wilaya in [16] AND quantity ≥ 5 → To Spam" holds a matching storefront order with the rule as reason and does not hold a non-matching one.
- [ ] "Flag as suspicious" creates the order with a risk flag visible in order data; "Always accept" prevents a built-in `JUNK_PHONE` hold for that order.
- [ ] Velocity condition `device_orders ≥ 3 in 24h` matches the third order from one device within 24 h but not the second.
- [ ] Rule-quality hint warns when a rule would have caught a majority of previously delivered orders.
- [ ] Rules are evaluated in list order; disabled rules are skipped.

**Verification**
- Unit: validator per field/op, predicate compiler table tests, hint thresholds. Integration: CRUD + limits, end-to-end hold/flag/accept through the public order endpoint.
- Browser: builder at `/settings/spam-rules/new` vs `data-model.md` "Spam rules" and `dashboard-captures.md` Spam protection; screenshots of a built rule.
- Multi-tenant: rules are per business/store; a rule of A never affects B's orders; cross-business rule id → 404.

**Out of scope:** the hold pipeline, device fingerprinting and blocks (P4.S5), customer ban (P4.S7).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S6 "Spam rule builder" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S6), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s6-spam-rules from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S6.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P4.S7 — Customers & bans

| Field | Value |
|---|---|
| **Goal** | Customers list and detail page derived from orders, with the block dialog (across all stores, optional cancel of unshipped orders) built on P4.S5's ban/unban endpoints, and `isBanned` surfaced on orders. |
| **Branch** | `feat/p4-s7-customers` |
| **GitHub issue** | `P4.S7 Customers & bans` (label `phase-4`, milestone `P4 Order operations`) |
| **Prerequisites** | P4.S1, P4.S5 merged |
| **Parallel-safe** | Yes, with P4.S2–S4, P4.S6. Owns `plugins/customers/**`, `packages/shared/src/customers/**`. Does not edit `plugins/spam/**` (calls its ban endpoints/service). |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered**
- Customers list: All / Repeat / New / Returned an order / Blocked; filters store, order status, orders, returns, spent, last order, wilaya; sort; export — `/orders/customers`
- Customer detail page — `/orders/customers/:id`
- Ban / unban by phone or device — `/orders/ban`, `/orders/unban` (customer-side UI, cancel-unshipped and projection; endpoints are P4.S5's; this session ticks the row)
- Customer detail page: KPIs, orders, addresses, internal note, WhatsApp/Call/Create order, block with reason (+ cancel unshipped) across all stores
- Buyer record on order, link to customer, edit contact, ban customer (`isBanned`/`banReason` projection here; button on the order page is P4.S3)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff notes of P4.S1 (cancel action) and P4.S5 (`SpamBlock`, `/orders/ban` + `/orders/unban`, `CustomerBanned`/`CustomerUnbanned` events, intake gate)
- `docs/research/second-pass.md` → "Customers (with data)" (detail layout, KPIs, block dialog text and reasons)
- `docs/research/dashboard-captures.md` → "Customers `/orders/customers`"
- `docs/research/data-model.md` → "Order (dashboard)" (`orderClient.isBanned`, `banReason`)
- `docs/research/api-surface.md` → "Customers & spam" (`/customers`, `/customers/export`), "Orders" (`/orders/ban`, `/orders/unban`, `/orders/client-history`)

**High-level plan**
1. Customer model: `Customer` keyed by (businessId, E.164 phone) maintained from orders (name, wilaya/commune, first/last order, counters, `internalNote`, `isBanned`, `banReason`, `bannedAt`, `bannedBy`); backfill from existing orders; update on order events → commit `feat(customers): customer entity and projection`
2. List API `/customers` with views all/repeat (≥2 orders)/new (1 order)/returned/blocked, filters (store, order status, orders, returns, spent, last order, wilaya), sort, search name/phone, pagination; `/customers/export` (csv/xlsx) → commit `feat(customers): list, filters and export`
3. Detail API: KPIs (orders + in progress, delivered x of y with % of finished, returned with last date, spent = delivered only), in-progress orders, all orders, addresses with usage counts, internal note update → commit `feat(customers): detail api`
4. Block customer: `blockCustomer(customerId, reason, alsoCancelUnshipped)` (reasons: refused delivery more than once, fake orders, abusive on the phone, other) calls P4.S5's ban service/endpoint (which writes `SpamBlock` business-wide so the intake gate refuses new orders), then optionally cancels unshipped pending/confirmed orders through P4.S1 actions; unblock calls `unban`; subscribe to `CustomerBanned`/`CustomerUnbanned` to project `isBanned`/`banReason` on the customer and on `orderClient`; turn on the ban capability flag read by P4.S3 → commit `feat(customers): block dialog service and ban projection`
5. Dashboard: list screen (tabs, filters, columns Customer/Wilaya/Orders/Delivery record/Spent/Last order), detail page (header buttons WhatsApp / Call / Create order, KPI tiles, tables, Contact, Addresses, Internal note, More actions: Copy phone, Block customer dialog with the exact refusal wording) → commit `feat(customers): customers ui`

**Deliverables:** `plugins/customers`, migrations, REST/GraphQL, two dashboard screens, ban capability flag consumed by P4.S3.

**Acceptance criteria**
- [ ] Repeat/New tabs are correct: a phone with 1 order is New, ≥2 is Repeat; "Returned an order" lists customers with ≥1 returned order; Blocked lists banned ones.
- [ ] Detail KPIs follow the rules: Spent counts delivered orders only; Delivered shows "x of y (% of finished)"; Returned shows last return date.
- [ ] Addresses list shows wilaya · commune · home/desk with a usage count.
- [ ] Blocking from the dialog shows "New orders from this number will be refused on all your stores. The N orders already placed stay as they are."; with "also cancel the order that hasn't shipped yet" ticked, unshipped orders become canceled, shipped ones stay.
- [ ] After a ban, a storefront submit with that phone is refused (no order created) in every store of the business and `isBanned` + `banReason` show on that customer's orders; unban restores ordering.
- [ ] Internal note persists; Create order opens `/orders/create` prefilled with the customer.
- [ ] Export respects filters and masks nothing the viewer is not allowed to see.

**Verification**
- Unit: projection updates from order events, KPI maths, view predicates. Integration: list/filter/sort, detail, ban/unban with cancel option, intake refusal.
- Browser: list and detail vs `dashboard-captures.md` "Customers" and `second-pass.md` "Customers (with data)"; block dialog screenshot.
- Multi-tenant: the same phone in businesses A and B yields two independent customers; banning in A never blocks B; detail of B's customer id from A → 404.

**Out of scope:** the order-page ban button (P4.S3), the ban/unban endpoints, `SpamBlock` storage, device-level blocks and held-order bans (P4.S5), WhatsApp messaging (P9.S5), per-customer marketing.

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P4.S7 "Customers & bans" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P4-order-ops.md (section P4.S7), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p4-s7-customers from an up-to-date phase/P4 (PR into phase/P4, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P4.S7.md` → commit → push → `gh pr create` → report PR link → stop.
