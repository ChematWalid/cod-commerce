# P6 — Inventory & finance

**Phase goal:** stock movements driven by delivery events, locations and packaging, the wallets ledger with carrier cash collection, the profit report with costs and ad spend, and the product study simulator.

**Exit criteria (from README):** Dispatch/return move stock; collections post to wallets; P&L for a range matches a hand-computed fixture.

**Session order and lanes:** P6.S1 first (needs P5.S3 merged). Then P6.S2 (locations/packaging) and P6.S3 (wallets) in parallel; P6.S4 (profit) after P6.S3. P6.S5 (simulator) has no dependency on the rest of P6 (needs only P1.S5) and can run any time, including before P6.S1.

**Conventions for all P6 sessions**
- Inventory and finance only SUBSCRIBE to domain events from `packages/shared/events` on the Vendure EventBus (`OrderDispatched`, `ReturnProcessed`, `OrderReturned`, `OrderDelivered`, `StockMovementRecorded`, `CarrierCollectionRecorded`); delivery code never calls them. `StockMovementRecorded` is defined by P6.S1, `CarrierCollectionRecorded` by P6.S3.
- Subscribers are idempotent (dedupe on event id + order id) so a replayed event never double-moves stock or money.
- Every entity carries `businessId` (+ `storeId` when store-scoped); every endpoint passes the tenant guard. Money is stored as integer minor-safe decimals in the wallet currency; DZD is the reporting currency.
- Plan gates call `requireFeature('<feature>')` from `packages/shared` (a no-op until P9.S1): tracked-items limit in inventory, full finance in finance.
- Own branding only: never use the name "Tassyir", its logo or copy.

---

## P6.S1 — Inventory core & auto movements

| Field | Value |
|---|---|
| **Goal** | Per-variant inventory with adjustments and movement history, automatically driven by dispatch and return events, with buy price frozen at sale. |
| **Branch** | `feat/p6-s1-inventory` |
| **GitHub issue** | `P6.S1 Inventory core & auto movements` (label `phase-6`, milestone `P6 Inventory & finance`) |
| **Prerequisites** | P5.S3 (and transitively P5.S1/S2, P2.S1, P4.S1) |
| **Parallel-safe** | Yes with P5.S4–S7. Owns `plugins/inventory/**`, `packages/shared/events/stock-movement-recorded.ts`. Replaces the `StockAvailability` no-op port from P5.S1 with a real provider (one registration line in the carriers config). |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered**
- Stock per variant: on shelf, at carrier, damaged, cost per unit; expand variants; filters store, stock status (low, out, at carrier)
- Add stock (product picker), adjust stock, import stock sheet (xlsx/csv, preview), export
- Auto movements: −1 on dispatch, +1 on restocked return, damaged bucket
- Movements history: type, item, direction, reason, note, price, date, link to order
- Buy-price history (cost frozen at time of sale)
- Stock warning when confirming (orders section)
- Inventory per variant with buy price and low-stock level; auto stock-out on dispatch; adjust with reasons (Received, Correction, Stock count, Damaged, Theft or loss, Promotion or gift); transfers between locations — *transfers deferred to P6.S2*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P5.S3.md`, `P5.S1.md` (`StockAvailability` port), `P4.S1.md` (`PreConfirmCheck` registry)
- `docs/research/data-model.md`: "Inventory" (batch endpoint, Inventory, Movement, reasons, KPI tiles, Add Stock UI, "stock is only tracked once a product has inventory")
- `docs/research/dashboard-captures.md`: "Inventory"; `docs/research/second-pass.md`: "Other order actions" (Process return: back to stock / damaged / didn't arrive); `docs/research/api-surface.md`: "Inventory" and `/orders/:id/stock`

**High-level plan**
1. Entities `Inventory` (variantId, quantity, lowQuantity, reservedQuantity, price/buy price, default location) and `StockMovement` (itemId, itemType, action in/out, quantity, price, previousQuantity, previousPrice, locationId, orderId, actorId, reason, note, itemDetails); `StockMovementRecorded` event; central `recordMovement` service in a transaction → commit `feat(inventory): inventory and movement entities`
2. `POST /inventory/batch`, `/inventory/add/:id`, `/inventory/adjust/:id` (reasons list), `/inventory/summary`, untrack; low/out status → commit `feat(inventory): add and adjust stock endpoints`
3. Subscribers: `OrderDispatched` → out (`order_dispatched`) and freeze buy price on the order line; `ReturnProcessed` → in (restock), damaged bucket, missing stays at-carrier; at-carrier quantity computed; real `StockAvailability` provider for dispatch preflight (`stockShort`) → commit `feat(inventory): dispatch and return subscribers`
4. Dashboard Inventory page: KPI tiles (Sellable qty + value, At carrier, Low stock, Damaged), Products tab with expandable variants, filters, Add Stock dialog (product picker, per-variant buy price/quantity/low alert, "Apply to all variants", empty = skip, 0 = start counting), Adjust stock dialog → commit `feat(inventory): inventory dashboard and add/adjust dialogs`
5. Movements tab (history with order links) and `GET /inventory/history`; stock sheet import (preview, xlsx/csv) and export → commit `feat(inventory): movements history and import/export`
6. Stock warning on confirm: `GET /orders/:id/stock` + "In stock · N available" per line in order detail, and a `PreConfirmCheck` provider registered in P4.S1's registry returning `warn` (never `block`) when a line is short → commit `feat(inventory): stock warning on confirm`

**Deliverables**
- Plugin `plugins/inventory` (server + dashboard), migrations, event definition, subscribers, import/export, `requireFeature('tracked_items')` call at tracking creation.

**Acceptance criteria**
- [ ] Batch add creates inventory with reason `received` ("Initial inventory creation (batch)") and a movement per variant.
- [ ] Dispatching an order lowers on-shelf stock by line quantity and records an `out` movement with `orderId` and reason `order_dispatched`; replaying `OrderDispatched` changes nothing.
- [ ] `ReturnProcessed` with restock 2 / damaged 1 / missing 1 adds 2 to shelf, 1 to damaged, leaves 1 counted at carrier; each recorded as movements with `StockMovementRecorded`.
- [ ] Returns processed for products without inventory do not create stock.
- [ ] Manual adjust supports ± and the six reasons; history lists type, item, direction, reason, note, price, date and links to the order.
- [ ] Order line cost is frozen at dispatch (later buy-price changes do not alter past orders' cost).
- [ ] Dispatching more than available reports the line in `stockShort` unless the product allows out-of-stock orders.
- [ ] KPI tiles and Low stock / Out / At carrier filters match seeded data; confirm warns when stock is short.
- [ ] Import preview flags bad rows; export round-trips through import.

**Verification**
- Unit: movement math, buy-price freezing, idempotent subscribers. Integration: event→movement flow with test Postgres and a fake dispatch/return; endpoints.
- Browser: Inventory (Products, Movements), Add Stock and Adjust dialogs vs Tassyir "Inventory" capture and data-model UI notes.
- Multi-tenant: inventory, movements, import and export for business A are invisible to B; an event for A never moves B's stock.

**Out of scope**
- Locations and transfers, packaging (P6.S2); wallet postings from stock purchases (P6.S3 subscribes to `StockMovementRecorded`); the 25-tracked-items enforcement (P9.S1).

**Kickoff prompt**
```
You are running session P6.S1 "Inventory core & auto movements" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P6-inventory-finance.md (section P6.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p6-s1-inventory from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P6.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P6.S2 — Locations, transfers & packaging

| Field | Value |
|---|---|
| **Goal** | Stock locations with transfers between them, and packaging inventory. |
| **Branch** | `feat/p6-s2-locations-packaging` |
| **GitHub issue** | `P6.S2 Locations, transfers & packaging` (label `phase-6`, milestone `P6 Inventory & finance`) |
| **Prerequisites** | P6.S1 |
| **Parallel-safe** | Yes with P6.S3, P6.S5. Owns `plugins/inventory/src/locations/**`, `plugins/inventory/src/packaging/**` and their dashboard tabs (Packaging tab, settings Locations tab); touches S1 files only via additive migrations. |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered**
- Packaging inventory: name, quantity, unit price, low-stock threshold, linked products; available/transit/delivered/damaged
- Stock locations: warehouse / shop / carrier hub, wilaya, address, ships from here
- Inventory per variant … transfers between locations — *transfers part*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff `P6.S1.md`
- `docs/research/data-model.md`: "Inventory" (default location auto-created; movements have `locationId`, `transferId`, `itemType: package`)
- `docs/research/dashboard-captures.md`: "Inventory" (Packaging columns, `/inventory/locations?includeInactive`); `docs/research/api-surface.md`: "Inventory" (`/inventory/locations/:id/default`, `/consolidate`, `/transfers`, `/packages/adjust/:id`)

**High-level plan**
1. `StockLocation` entity (type warehouse/shop/carrier hub, wilaya, address, shipsFromHere, isDefault, isActive), default created per store, per-location quantities on inventory → commit `feat(inventory): stock locations`
2. Locations settings tab: CRUD, set default, deactivate, consolidate (move all stock into one) → commit `feat(inventory): locations settings and consolidate`
3. Transfers: `POST /inventory/transfers` creating paired out/in movements sharing `transferId`, with validation of available quantity; transfer dialog → commit `feat(inventory): transfers between locations`
4. Packaging entity (name, quantity, unit price, low threshold, linked products) with counters available/transit/delivered/damaged, `POST /inventory/packages/adjust/:id`, movements with `itemType: package` → commit `feat(inventory): packaging inventory`
5. Packaging tab UI (columns Packaging, Available Stock, Transit, Delivered, Damaged, Unit Price, Actions; Add Packaging); auto consume/transit/deliver counters via existing dispatch/delivered/return events for linked products → commit `feat(inventory): packaging tab and event-driven counters`

**Deliverables**
- Locations and packaging modules inside `plugins/inventory`, migrations, two dashboard tabs, transfer dialog, endpoints named above.

**Acceptance criteria**
- [ ] A default location exists per store; only one default at a time; "ships from here" locations feed dispatch stock availability.
- [ ] A transfer moves N units A→B atomically: two movements share a `transferId`, totals unchanged, cannot exceed available.
- [ ] Consolidate moves all stock to one location and leaves the others empty and deactivatable.
- [ ] Packaging low-stock alert fires below threshold; a linked product's dispatch moves packaging available→transit, delivery→delivered, damaged return→damaged (event-driven, idempotent).
- [ ] Packaging adjust writes movements with `itemType: package`.

**Verification**
- Unit: transfer validation, packaging counter transitions. Integration: events → packaging counters; transfers with test Postgres.
- Browser: Packaging tab and Locations settings vs Tassyir "Inventory" (Packaging) capture.
- Multi-tenant: locations, transfers and packaging are per business/store; cross-tenant transfer attempts are rejected.

**Out of scope**
- Core stock and movements (P6.S1); carrier hub reconciliation with real carriers.

**Kickoff prompt**
```
You are running session P6.S2 "Locations, transfers & packaging" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P6-inventory-finance.md (section P6.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p6-s2-locations-packaging from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P6.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P6.S3 — Wallets ledger & carrier collections

| Field | Value |
|---|---|
| **Goal** | Multi-currency wallets with an automatic ledger, carrier cash held and collection recording, payouts, forecast and "money right now". |
| **Branch** | `feat/p6-s3-wallets` |
| **GitHub issue** | `P6.S3 Wallets ledger & carrier collections` (label `phase-6`, milestone `P6 Inventory & finance`) |
| **Prerequisites** | P6.S1 |
| **Parallel-safe** | Yes with P6.S2, P6.S5. Owns `plugins/finance/**` (wallets, collections, outlook), `packages/shared/events/carrier-collection-recorded.ts`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered**
- Wallets: create (DZD/USD/EUR), add cash, spend, move money, correct balance, rename, archive; ledger with filters; capital add/reduce
- Money in / money out, your money right now, cash outlook
- Carrier cash: held per carrier, payouts, record a collection into a wallet, opening balance
- Automatic wallet ledger: stock purchases, return fees, carrier payouts; overdrawn warning; "What's coming" cash forecast
- Carrier collection with expected vs received and difference category
- P&L "at most" … working money (carriers + road + stock) — *working-money part only; P&L in P6.S4*
- Plan gate: full finance on Advanced only — *call `requireFeature('finance')`; enforced in P9.S1*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P6.S1.md`, `P5.S2.md`, `P5.S3.md`
- `docs/research/second-pass.md`: "Cash collection and finance (performed)" (Record a collection, Automatic wallet ledger, What's coming, "Your money right now")
- `docs/research/dashboard-captures.md`: "Finance" (Wallets, Home money-on-the-way notes); `docs/research/api-surface.md`: "Finance" (`/finance/wallets`, `/transactions`, `/movements`, `/capital`, `/cashout/delivery*`, `/payouts/refresh`, `/money-map`, `/outlook`)

**High-level plan**
1. Entities `Wallet` (name, currency DZD/USD/EUR, archived; default "Cash" auto-created) and append-only `WalletTransaction` ledger (type, subject, pot, actor, amount, refs); balance derived from ledger; `requireFeature` hook → commit `feat(finance): wallets and ledger`
2. Wallet operations: add cash, spend, move money (same-currency, paired entries), correct balance ("Record what you actually have"), rename, archive, capital add/reduce; ledger filters (pots, types, In/Out) and totals Money in / out / Net → commit `feat(finance): wallet operations and ledger filters`
3. Event subscribers: `StockMovementRecorded` with reason `received` and a price → "Stock purchase" (one per variant); `OrderReturned` → "Return fee" (default DZD 200 per returned parcel, configurable per business); `CarrierCollectionRecorded` → "Carrier payout" (+) → commit `feat(finance): automatic ledger entries from events`
4. Carrier cash held per carrier (delivered-not-paid order totals minus fees), `POST /finance/cashout/delivery {deliveryAgentId, walletId, note, amount?}` creating `Collection` (expected vs received, `difference`, `differenceCategory`, `orderCount`, `isOpeningBalance`), emits `CarrierCollectionRecorded`; payouts list and refresh hook for carriers that report payouts → commit `feat(finance): carrier cash held and collections`
5. Dashboard: Finance → Wallets tab (pots, New wallet, Add cash, Spend, ledger), Record collection dialog (held per carrier, amount defaults to all held, More options: into wallet / not into a wallet, note, "Record DZD N"), overdrawn warning → commit `feat(finance): wallets and collection screens`
6. "What's coming" forecast (7/30/90 days: due expenses vs cash; nudge when none) and "Your money right now" (at carriers, on the road, in stock at buy price = working money, last collection) → commit `feat(finance): outlook and money-right-now`

**Deliverables**
- Plugin `plugins/finance` (wallets, collections, outlook modules; P6.S4 adds profit/costs to the same plugin in separate folders), endpoints named above, migrations, dashboard tabs.

**Acceptance criteria**
- [ ] First access creates a default "Cash" DZD wallet; balances equal the sum of ledger entries; entries are append-only (corrections are new entries).
- [ ] Adding stock at a buy price posts one "Stock purchase" per variant to the default wallet; replayed events do not duplicate.
- [ ] A returned parcel posts a Return fee (default 200 DZD, editable in settings) once per parcel.
- [ ] Held cash per carrier equals delivered-not-yet-collected COD totals; Record collection defaults to all held; recording creates a `Collection` with `expectedAmount`, `difference` and `differenceCategory`, a "Carrier payout" ledger entry, and emits `CarrierCollectionRecorded`; "Not into a wallet" records without ledger entry. Toast "Collection from <carrier> recorded".
- [ ] Opening-balance collection is supported once per carrier and flagged `isOpeningBalance`.
- [ ] Move money between wallets of different currencies is rejected; spend that overdraws shows the warning "usually because your starting cash was never recorded → Record what you actually have".
- [ ] Forecast for 7/30/90 days sums due expenses against cash; empty state shows the nudge to add rent/salaries.
- [ ] Working money = at carriers + on the road + stock at buy price, verified on a seeded fixture.

**Verification**
- Unit: ledger invariants, balance derivation, collection difference categories, forecast windows. Integration: event→ledger flow (stock add, return, collection) on test Postgres.
- Browser: Finance → Wallets, Record collection dialog, What's coming vs Tassyir second-pass "Cash collection and finance" and "Finance" capture.
- Multi-tenant: wallets, ledger, collections and held amounts are per business; recording a collection against another business's carrier or wallet is rejected.

**Out of scope**
- Expenses, ad spend and P&L (P6.S4); real payout APIs from carriers beyond the refresh hook (adapters can add later); home dashboard "Money on the way" widget (P7.S2).

**Kickoff prompt**
```
You are running session P6.S3 "Wallets ledger & carrier collections" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P6-inventory-finance.md (section P6.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p6-s3-wallets from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P6.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P6.S4 — Profit report, costs & ad spend

| Field | Value |
|---|---|
| **Goal** | The profit-and-loss report for any date range, with expenses, ad spend, exchange rates and per-product/wilaya/ad profit. |
| **Branch** | `feat/p6-s4-profit-costs` |
| **GitHub issue** | `P6.S4 Profit report, costs & ad spend` (label `phase-6`, milestone `P6 Inventory & finance`) |
| **Prerequisites** | P6.S3 (and P1.S4 for salaries) |
| **Parallel-safe** | Yes with P6.S2, P6.S5. Owns `plugins/profit/**` (report, per-product) and `plugins/finance/src/costs/**` (expenses, ad spend, exchange rates). |
| **Model / size** | Opus · L |
| **External needs** | None. Ad data comes from manual records now; campaign linking and synced spend arrive in P9.S4. |

**Inventory rows covered**
- Profit report for a date range: collected revenue − product cost − delivery (net) − returns = gross profit − ad spend − expenses = net; profit and ad cost per delivered order; delivery and confirmation rates
- "Missing from this profit" checklist (no buy price, ad account disconnected, no costs)
- Money in / money out (chart) — *chart only; balances in P6.S3*
- Expenses: one-time / recurring / per order, categories (packaging, confirmation calls, shoot, influencer, rent, salaries, calls, other), scope (product / store / business), paid from wallet, next due, process due
- Ad spend records: platform, currency (DZD/USD/EUR), amount, date, product, wallet
- Exchange rates (what 1 USD costs you, history)
- Per-product profit (losing money filter, spread shared costs)
- Per-product by wilaya and per-product by ad (break-even cost per order) — *ads data filled later by P9.S4*
- Member actions (limit, stop receiving, pay salary) — *salary payment recorded as an expense*
- P&L "at most" with missing-cost warnings

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P6.S3.md`, `P6.S1.md`, `P1.S4.md`
- `docs/research/second-pass.md`: "Cash collection and finance (performed)" — **Profit report worked example** (all numbers below come from it)
- `docs/research/dashboard-captures.md`: "Finance" (Report, Costs, Products, Wilayas, Ads); `docs/research/api-surface.md`: "Finance" (`/finance/pnl`, `/products`, `/products/:id/wilayas`, `/products/:id/ads`, `/ads-spend`, `/exchange-rates`, `/health`) and `/expenses`, `/expenses/process-due`

**High-level plan**
1. Entities: `Expense` (type one-time/recurring/per-order, category, scope product/store/business, amount, wallet, next due, status), `AdSpend` (platform, currency, amount, date, productId, walletId), `ExchangeRate` history; CRUD endpoints → commit `feat(finance): expenses, ad spend and exchange rates`
2. Expense processing: recurring schedule, `POST /expenses/process-due` plus BullMQ daily job posting wallet transactions (paid from wallet); salary payments from team (P1.S4) recorded as `salaries` expenses → commit `feat(finance): recurring expenses and salary payments`
3. P&L service: collected revenue (delivered orders' collected totals) − product cost at sale (frozen cost from P6.S1) + delivery net − returns (return fees) = gross − ad spend (converted at the rate in force on the date) − expenses = net "at most"; KPIs profit per delivered, ad cost per delivered, delivery rate, confirmation rate; `/finance/pnl` and `/finance/health` (missing-cost checklist) → commit `feat(profit): pnl report and missing-cost health`
4. Worked-example fixture test reproducing the second-pass numbers (below) and edge cases (missing buy price → "Incomplete", multi-currency ad spend) → commit `test(profit): worked-example fixture`
5. Per-product profit (All / Losing money; spread shared costs toggle), per-product by wilaya, per-product by ad with break-even cost per order → commit `feat(profit): per-product, wilaya and ad profit`
6. Dashboard Finance tabs Report (waterfall, KPI tiles, Missing-from-profit actions, Money in/out chart, date presets Today / Last 7 days / This month / Last month / Custom), Costs, Products, Wilayas, Ads → commit `feat(profit): finance report, costs and product tabs`

**Deliverables**
- Plugins `plugins/profit` and costs module in `plugins/finance`, endpoints above, BullMQ job, migrations, dashboard tabs.

**Acceptance criteria**
- [ ] Fixture: collected revenue 8,820; product cost 4,000 (45%); delivery net +800 (9%); returns 200 (2%) → gross profit 5,420 (61%); ad spend 0; expenses 0 → net "at most" +5,420 with the warning "your real profit is lower: 1 cost is missing"; delivery rate 50%, confirmation rate 75%.
- [ ] A variant without buy price flags the order cost as missing: profit-per-delivered shows "Incomplete" and the checklist links to add buy prices.
- [ ] Ad spend in USD/EUR converts using the rate valid on the spend date; changing the rate later does not rewrite past reports (history respected).
- [ ] Recurring expense creates entries on each due date exactly once (idempotent process-due), debits the chosen wallet, and updates next due; per-order expenses attach to delivered orders.
- [ ] Expense scope product/store/business is respected in per-product and store-filtered views; "Spread shared costs" distributes business-scoped costs across products.
- [ ] Losing-money filter lists products with negative profit; wilaya view sorts by most profit / lowest delivery rate; ad view shows break-even cost per order.
- [ ] Paying a team member's salary creates a salaries expense and wallet debit.
- [ ] `requireFeature('finance')` guards the module (no-op until P9.S1).

**Verification**
- Unit: P&L arithmetic and rounding, currency conversion by date, spread logic, due-date generation. Integration: the worked-example fixture through the real endpoint on test Postgres.
- Browser: Finance Report/Costs/Products/Wilayas/Ads vs Tassyir "Finance" capture and second-pass profit example; screenshot the waterfall.
- Multi-tenant: P&L, expenses, ad spend, rates and per-product views for business A never include B's data; date ranges and store filters respect the tenant guard.

**Out of scope**
- Linking Meta/TikTok campaigns to products and synced spend (P9.S4); wallet ledger and collections (P6.S3); home dashboard KPIs (P7.S2).

**Kickoff prompt**
```
You are running session P6.S4 "Profit report, costs & ad spend" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P6-inventory-finance.md (section P6.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p6-s4-profit-costs from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P6.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P6.S5 — Product study simulator

| Field | Value |
|---|---|
| **Goal** | A profit simulator where a merchant models a product's economics and saves studies. |
| **Branch** | `feat/p6-s5-simulator` |
| **GitHub issue** | `P6.S5 Product study simulator` (label `phase-6`, milestone `P6 Inventory & finance`) |
| **Prerequisites** | P1.S5 |
| **Parallel-safe** | Yes with any session. Owns `plugins/simulator/**` only. |
| **Model / size** | Sonnet · S |
| **External needs** | None. |

**Inventory rows covered**
- Product study simulator: buy/sale price, ad budget, ad cost per order, USD rate, confirmation and delivery rates, packaging, COD fee, return fee, delivery fee difference, fixed costs

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff `P1.S5.md`
- `docs/research/dashboard-captures.md`: "Finance" (Product study `/finance/simulator`); `docs/research/api-surface.md`: "Finance" (`/simulations`, `/simulations/:id`); `docs/feature-inventory.md` section 10 row text
- `docs/research/second-pass.md`: "Cash collection and finance" for how cost, delivery net and returns are defined

**High-level plan**
1. Pure calculation module in `packages/shared` (or the plugin) taking the study inputs and returning cost per order, profit per delivered order, profit per order placed, break-even ad cost, total profit for the ad budget → commit `feat(simulator): study calculation model`
2. `Simulation` entity (name, inputs, outputs snapshot, store/business scope), `/simulations` CRUD → commit `feat(simulator): saved studies api`
3. Dashboard Finance → Product study tab: form (buy price, sale price, ad budget/day, ad cost per order, USD rate, confirmation rate, delivery rate, packaging, COD fee, return fee, delivery fee difference, fixed costs/staff), live results panel, "New study", saved list with open/duplicate/delete → commit `feat(simulator): product study screen`
4. Formula README with the three worked scenarios, EN/AR strings, isolation test and screenshots → commit `test(simulator): scenarios, i18n and isolation`

**Deliverables**
- Plugin `plugins/simulator` (server + dashboard), calculation unit tests, migration.

**Acceptance criteria**
- [ ] Changing any input updates cost per order and profit outputs live; USD-denominated inputs convert at the entered rate.
- [ ] Formulas are documented in the plugin README with worked examples; at least three hand-computed scenarios pass in unit tests (profitable, losing, zero delivery rate guarded without NaN/Infinity).
- [ ] A study can be saved, listed, reopened with identical outputs, duplicated and deleted.
- [ ] Return fee and COD fee default to the business's configured values when finance settings exist, otherwise to constants.
- [ ] Inputs are validated (rates 0–100%, non-negative money) with zod schemas shared with the server.

**Verification**
- Unit: calculation scenarios and edge cases. Integration: `/simulations` endpoints.
- Browser: Product study screen vs Tassyir "Finance → Product study" capture (New study flow).
- Multi-tenant: studies are per business; reading or editing another business's study returns 404.

**Out of scope**
- Pulling live data from real orders (P6.S4); plan gating (P9.S1).

**Kickoff prompt**
```
You are running session P6.S5 "Product study simulator" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P6-inventory-finance.md (section P6.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p6-s5-simulator from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P6.S5.md` → commit → push → `gh pr create` → report PR link → stop.
