# P5 — Delivery

**Phase goal:** carrier adapter framework, dispatch, tracking, returns and exchanges, then one adapter family per session.

**Exit criteria (from README):** Private courier loop dispatch→deliver→return works end to end; each real carrier adapter passes its contract tests against a mock.

**Session order and lanes:** P5.S1 → P5.S2 (serial, each needs the previous merged). After P5.S2, five parallel lanes: P5.S3 (returns), P5.S4 (Yalidine), P5.S5 (Ecotrack), P5.S6 (ZR/NOEST/Maystro), P5.S7 (other carriers). Each lane owns its own plugin folder(s); the only shared edits are one-line registrations in `apps/server` config and the `carriers` plugin's catalogue registry (append your family; keep both lines on conflict). P6.S1 needs P5.S3 only, so P6 can start while P5.S4–S7 are still open.

**Conventions for all P5 sessions**
- Domain events live in `packages/shared/events` and are defined by the first session that emits them: `OrderDispatched` (P5.S1), `ParcelStatusChanged` / `OrderDelivered` / `OrderReturned` (P5.S2), `ReturnProcessed` (P5.S3). Inventory and finance (P6) subscribe to these; P5 code never calls P6 code.
- Adapters run against contract-test mock servers (request/response fixtures in `plugins/<name>/test/fixtures`) until credentials exist. Credentials are stored through `TenantSecretService` (P1.S6, envelope-encrypted, write-only) and never logged or returned by the API.
- Platform plumbing from P1.S6 is mandatory: carrier webhooks register an `InboundWebhookHandler` on the gateway (`/webhooks/<provider>/:accountKey`, never an own route); polling runs from the `carrier-poll-tick` scheduled task on the `carrier-polling` queue; dispatch runs on the `dispatch` queue with a per-carrier-account token bucket and `withCircuitBreaker`; every parcel event goes through the shared `applyParcelEvent` (P5.S2) and emits through the outbox. See `docs/architecture/system-design.md` §2.3, §2.4, §2.6 and ADR 0013/0016.
- **Where the carrier API shape comes from:** `docs/research/` only covers the connect forms, not the carrier APIs. Each adapter session's first step is to find the carrier's **official public developer documentation** (or official SDK), record URL, version and retrieval date in `plugins/<name>/API-SOURCE.md`, and write fixtures from it marked `synthetic: true`. If no public docs exist for a carrier, implement config + connect form + `capabilities` only, mark the adapter `experimental`, and list it in the handoff as blocked on credentials/docs (do not invent endpoints). A contract suite that passes only against a mock the same session wrote proves the mapping logic, not the real API: the PR says so, and the fixtures are re-recorded when credentials arrive.
- Adapter sessions P5.S4–S7 share rows ("Dispatch to carrier API…", "Status sync…", "Carrier connect forms…"): per README "Rows split across sessions", only the last of them to merge ticks those rows.
- Every entity carries `businessId` (+ `storeId` when store-scoped); every new query/endpoint passes the tenant guard.
- Own branding only: never use the name "Tassyir", its logo or copy, and do not call its endpoints.

---

## P5.S1 — Carrier adapter interface, Private Courier & dispatch

| Field | Value |
|---|---|
| **Goal** | Define the `CarrierAdapter` contract, the carrier catalogue and schema-driven connect forms, ship the Private Courier, and build the dispatch flow with the full failure taxonomy. |
| **Branch** | `feat/p5-s1-carrier-dispatch` |
| **GitHub issue** | `P5.S1 Carrier adapter interface, Private Courier & dispatch` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P4.S1 (order state machine), P3.S1 (wilaya/commune data, delivery pricing); P1.S4 (team members, transitively required by Private Courier); P1.S6 (tenant secrets, queues, circuit breaker, outbox) |
| **Parallel-safe** | No. Owns `plugins/carriers/**`, `packages/shared/carriers/**`, `packages/shared/events/order-dispatched.ts`. |
| **Model / size** | Opus · L |
| **External needs** | None. Families beyond Private Courier are listed in the catalogue but their adapters arrive in P5.S4–S7 (shown "coming soon"). |

**Inventory rows covered**
- Carrier accounts list (agent, system, status), edit, refund rates, delete
- Connect carrier from catalogue: Yalidine platform (Yalidine, Economiqua, Goupex, WeCan…), Ecotrack platform (DHD, Anderson, TSL, Navex, 48HR…), Maystro, ZR Express, NOEST, Elogistia, Ecom Delivery, Zimou, Osen; Private Courier — *this session: catalogue, schema-driven forms, Private Courier; real adapters in P5.S4–S7*
- Multiple accounts per carrier; choose carrier per order; default per store
- Dispatch to carrier API, tracking number back, carrier rejection reason — *this session: dispatch flow + Private Courier; real APIs in P5.S4–S7*
- Parcel opening allowed/not (orders section)
- Carrier connect forms: credentials per carrier (API ID/Token/Webhook secret/departure wilaya for Yalidine; Token/Base URL for Ecotrack; API key/ID for ZR; GUID/Token for NOEST…), auto-validate on dispatch, parcel-opening note, overweight fee (allowance + rate, volumetric for ZR), parcel opening allow/deny — *this session: form engine and common fields; per-carrier credentials in P5.S4–S7*
- Private courier tied to a team member
- Order states and actions: … dispatch (with failure taxonomy) — *dispatch part only*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P4.S1.md`, `P3.S1.md`, `P1.S4.md`, `P1.S6.md`; ADR 0009 §2 (dispatch = Fulfillment), ADR 0013 (dispatch queue, breaker); `docs/architecture/system-design.md` §2.6
- `docs/research/second-pass.md`: "Carriers (connect forms)", "Storefront order → delivered" steps 6–8, "Other order actions"
- `docs/research/dashboard-captures.md`: "Delivery & Shipping"
- `docs/research/data-model.md`: "Order" (deliveryAgent, carrierFee, deliverySpeed); `docs/research/api-surface.md`: "Delivery" and dispatch/preflight/undispatch/validate entries under "Orders"

**High-level plan**
1. Shared types + `CarrierAdapter` interface (`validateCredentials`, `createParcels`, `cancel`, `validate`, `getStatuses` / `handleWebhook`, `getLabels`, `syncPrices`, `supportsExchange`, `capabilities`, credential/config JSON-schema) and adapter registry → commit `feat(carriers): carrier adapter interface and registry`
2. Entities `CarrierAccount` (credentials stored via TenantSecretService from P1.S6, account name, auto-validate, write-opening-note, overweight allowance/rate/volumetric, parcel-opening policy, assigned employee), store default carrier, per-order carrier; migrations → commit `feat(carriers): carrier account entities with encrypted credentials`
3. Catalogue of system families with schema-driven connect forms (dashboard React) and accounts list (name, system, assignee, status, created; Edit, Refund Rates, Delete) → commit `feat(carriers): catalogue, connect forms and accounts list`
4. Private Courier adapter bound to a team member; manual status model in shared (To Desk, In Desk, In Transit, Arrived at Province, Out for Delivery, Delivered, Returned); tracking number = order number → commit `feat(carriers): private courier adapter`
5. Dispatch preflight (wrong phone, province/town unavailable, auth, rate limit, sender balance, stock through an injectable `StockAvailability` port that defaults to "ok" until P6.S1) and `POST /orders/dispatch {ids, agentId}` returning the full taxonomy; parcel opening note; dispatch executes asynchronously on the dispatch queue (jobId = parcelId, per-carrier-account token bucket and circuit breaker from P1.S6); POST /orders/dispatch returns {dispatchBatchId, preflightFailures} and GET /orders/dispatch/:batchId returns per-order results with the full taxonomy (UI polls every 1 s) → commit `feat(carriers): dispatch endpoint with failure taxonomy`
6. Emit `OrderDispatched`; order transitions to dispatched the way ADR 0009 prescribes (Vendure Fulfillment via a `FulfillmentHandler`, or the custom state from P4.S1); enable bulk Dispatch button and "Select delivery agent" dialog in the orders list/detail; contract-test mock-server helper reused by P5.S4–S7 → commit `feat(carriers): dispatch UI and OrderDispatched event`

**Deliverables**
- Plugin `plugins/carriers` (server + dashboard): carrier accounts CRUD, `POST /orders/dispatch`, `POST /orders/dispatch/preflight`, migrations, shared event/types, contract-test helper documented in the handoff.

**Acceptance criteria**
- [ ] Catalogue lists the 10 system families; each connect form is rendered from its adapter's schema (credential fields, account name, auto-validate, opening-note, overweight allowance/rate, parcel opening allow/deny).
- [ ] Two accounts of one family coexist (told apart by account name); a store default carrier is applied to new orders; a per-order carrier can be changed while the order is confirmed.
- [ ] Private Courier requires an assigned team member; toast "Private Courier connected"; row shows name, system, assignee, status Active, created date, Edit / Refund Rates / Delete.
- [ ] Credentials are encrypted at rest and never in logs or API responses (test asserts masked value).
- [ ] Dispatching a confirmed order with Private Courier sets dispatched, `dispatchedAt`, tracking number = order number, and emits `OrderDispatched` once; the batch result (`GET /orders/dispatch/:batchId`) contains `dispatchedOrders`, `nonDispatchedOrders`, `wrongPhone`, `provinceUnavailable`, `townUnavailable`, `stockShort`, `carrierAuthFailed`, `carrierRateLimited`, `senderBalanceRequired`, `validationQueued`, `failureReasons`.
- [ ] Bulk dispatch of mixed valid/invalid orders partially succeeds and reports each reason; toast "Successfully dispatched N out of M order(s)".
- [ ] With "Write parcel opening in the delivery note" on, the note is prefixed « Ouverture du colis : autorisée / non autorisée » according to the order/product policy.
- [ ] Non-confirmed orders are refused; double dispatch is idempotent.
- [ ] Dispatching 100 orders returns within 1 s with a batch id; a carrier outage opens the breaker and leaves orders in Confirmed with a "carrier unavailable" reason, not lost.

**Verification**
- Unit: preflight rules, taxonomy mapping, credential encryption, adapter registry. Integration: dispatch endpoint against test Postgres with a fake adapter failing in each way.
- Browser: Delivery → Add Delivery Agent and the Select-delivery-agent dialog vs Tassyir "Delivery & Shipping" capture and second-pass "Storefront order → delivered" step 6.
- Multi-tenant: business B cannot list, read, edit, use for dispatch, or see credentials of business A's carrier accounts; dispatching with another business's `agentId` is rejected.

**Out of scope**
- Tracking list/drawer/labels (P5.S2); real carrier APIs (P5.S4–S7); stock deduction (P6.S1); delivery pricing screens (P3.S1).

**Kickoff prompt**
```
You are running session P5.S1 "Carrier adapter interface, Private Courier & dispatch" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s1-carrier-dispatch from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P5.S2 — Tracking, parcel drawer & labels

| Field | Value |
|---|---|
| **Goal** | Tracking list with filters, parcel drawer with manual status updates, undispatch/validate, labels, late-parcel detection, export, and the parcel status events. |
| **Branch** | `feat/p5-s2-tracking` |
| **GitHub issue** | `P5.S2 Tracking, parcel drawer & labels` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P5.S1 |
| **Parallel-safe** | No (P5.S3–S7 all start from this). Owns `plugins/tracking/**`, `packages/shared/events/parcel-status-changed.ts`, `order-delivered.ts`, `order-returned.ts`. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered**
- Tracking list: Active / Awaiting validation / On the way / Delivered / All
- Filters: store, status (Awaiting validation, To desk, In desk, In transit, Arrived at province, Suspended, Out for delivery…), movement (not moving), payment (awaiting carrier payment, paid, withdrawn), wilaya, dispatched date, assignee, delivery type, item count; refresh
- Normalised status + raw carrier label; copy tracking number
- Late-parcel detection (stuck longer than usual for its stage)
- Export deliveries: Everything / Follow-up list / Cash reconciliation; Excel / CSV
- Undispatch, validate parcels, label status, print labels
- Parcel drawer: stepper, Overview/History/Notes, Print label, Undispatch, Update Status (To Desk, In Desk, In Transit, Arrived at Province, Out for Delivery, Delivered, Returned)
- Cancel reasons seed set (7 Arabic reasons), "require a reason" toggle; custom status with colour; label statuses for tracking — *label statuses part only*
- Courier notes surfaced as notifications — *this session: capture only; notifications in P7.S3*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff `P5.S1.md`
- `docs/research/second-pass.md`: "Storefront order → delivered" steps 7–8 and the order-record field list; "Other order actions" (Delivered / Intermediate tracking / Returned rows); "Status settings" (label statuses)
- `docs/research/dashboard-captures.md`: "Tracking"; `docs/research/api-surface.md`: "Orders" tracking/export/labels/validate/undispatch entries

**High-level plan**
1. Extend P5.S1's shared parcel status model (do not redefine it) with the raw-label mapping helper, history entries `{timestamp, trackingStatus, duration}` in the partitioned `parcel_event` table (P1.S6 partition helper), the shared `applyParcelEvent` (dedupe by event key, ignore events older than the current status, update `cod_order`, write the outbox event in the same transaction) used by webhooks, polling and manual updates, events `ParcelStatusChanged`, `OrderDelivered`, `OrderReturned` → commit `feat(tracking): parcel status history and events`
2. Tracking service + `GET /orders/tracking` (views/tabs, filters, search by order/phone/name/tracking no., pagination), `PATCH /orders/tracking/:id`, `POST /orders/deliver/:id`, `POST /orders/return/:id` → commit `feat(tracking): tracking list API and status transitions`
3. Undispatch (adapter cancel, order back to confirmed, `canUndispatch`), validate (single/bulk), refresh via adapter `getStatuses` → commit `feat(tracking): undispatch and validate`
4. Dashboard: tracking list (columns Order Number, Dispatched, Products, Customer, Shipment, Tracking Status, Total), filters, deep-link params (`late=1`, `view`, `payout`, `carrier`, `dateFrom/dateTo`), parcel drawer with stepper and Update Status → commit `feat(tracking): tracking list and parcel drawer`
5. Label statuses (kind=label) on tracking; courier notes captured into parcel Notes (`hasNotes`, `notesHistory`) → commit `feat(tracking): label statuses and courier notes`
6. Late-parcel detection BullMQ job (per-stage thresholds as shared constants) and export (Everything / Follow-up list / Cash reconciliation; xlsx/csv; files written to the private bucket in Algerian object storage, presigned download, never R2, ADR 0011/0012) → commit `feat(tracking): late detection and export`
7. Label PDF generation in our own layout with `pdf-lib` (order no., barcode, recipient, wilaya/commune, COD amount, items; bulk print; use carrier label when the adapter provides one). Labels and delivery sheets contain buyer names, phones and addresses, so generated and fetched PDFs are stored only in the private bucket in Algerian object storage (MinIO), never R2 (ADR 0011/0012) → commit `feat(tracking): label pdf generation`

**Deliverables**
- Plugin `plugins/tracking` (server + dashboard), late-parcel job, export service, label renderer, events in `packages/shared/events`.

**Acceptance criteria**
- [ ] Tabs Active / Awaiting validation / On the way / Delivered / All partition seeded data correctly; each listed filter narrows results (including "not moving" and payment awaiting/paid/withdrawn).
- [ ] Each parcel shows normalized status plus raw carrier label; copying the tracking number works.
- [ ] Drawer stepper runs Awaiting Validation → In Transit → Out for Delivery → Delivered; Update Status (manual carriers only) offers To Desk, In Desk, In Transit, Arrived at Province, Out for Delivery, Delivered, Returned; intermediate → `PATCH /orders/tracking/:id`, Delivered → `POST /orders/deliver/:id`, Returned → `POST /orders/return/:id`.
- [ ] Each transition appends history with duration and emits `ParcelStatusChanged`; delivered emits `OrderDelivered`, returned emits `OrderReturned`, each once (idempotent).
- [ ] Undispatch only when `canUndispatch`; order returns to confirmed, the carrier cancel is called, the parcel leaves tracking.
- [ ] Late job flags parcels stuck beyond their stage threshold; `?late=1` lists them.
- [ ] Export yields valid xlsx and csv for all three modes; label PDF shows correct order data, bulk prints one page per parcel; export and label files are written only to the private Algerian bucket (no R2 write in the test's storage mock).
- [ ] Courier notes arriving from an adapter are stored and visible under Notes.

**Verification**
- Unit: status normalization, late thresholds, export row builders. Integration: tracking endpoints and event emission against test Postgres with a fake adapter.
- Browser: `/tracking` list and drawer vs Tassyir "Tracking" capture and second-pass steps 7–8.
- Multi-tenant: list, export, label and status endpoints never return or mutate another business's parcels (guessed ids return 404).

**Out of scope**
- Returns processing and exchanges (P5.S3); real carrier polling/webhooks (P5.S4–S7); notifying on courier notes (P7.S3); stock and wallet effects (P6).

**Kickoff prompt**
```
You are running session P5.S2 "Tracking, parcel drawer & labels" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s2-tracking from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P5.S3 — Returns & exchanges

| Field | Value |
|---|---|
| **Goal** | Returns list and processing dialog, barcode scan flow, and exchanges as linked parcels, emitting `ReturnProcessed`. |
| **Branch** | `feat/p5-s3-returns` |
| **GitHub issue** | `P5.S3 Returns & exchanges` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P5.S2 |
| **Parallel-safe** | Yes with P5.S4–S7. Owns `plugins/returns/**`, `packages/shared/events/return-processed.ts`. |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered**
- Returns: To process / Processed / All; filters; process to Restock or Damaged
- Scan returns with barcode (sound feedback, bulk restock/damaged)
- Exchanges as linked parcel (exchange + process-return)
- Return processing dialog: back to stock / damaged / didn't arrive split, team notes
- Exchanges limited to carriers that support them (Ecotrack, Yalidine family, ZR, Ecom Delivery)
- More actions: exchange entry only (rest of the menu is P4)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoff `P5.S2.md`
- `docs/research/second-pass.md`: "Other order actions" (Process return and Exchange rows)
- `docs/research/dashboard-captures.md`: "Returns"; `docs/research/data-model.md`: "Order" (isExchange, isExchangeReturn, exchangeOfOrderId, exchangeSiblingOrderId); `docs/research/api-surface.md`: `/orders/returns`, `/exchange`, `/exchange-prefill`, `/exchange/process-return`

**High-level plan**
1. `ReturnProcessed` event (lines with `restockQty`, `damagedQty`, `missingQty`) and return record model → commit `feat(returns): return model and ReturnProcessed event`
2. `GET /orders/returns` (To process / Processed / All; filters store, wilaya, return date, product; sort) and `POST /orders/returns/process/:id` with quantity validation → commit `feat(returns): returns list and process endpoint`
3. Dashboard returns list + process dialog (returned qty, Damaged Quantity, "Some units didn't arrive?", live split Back to stock N · Damaged N, team notes also posted to order comments) → commit `feat(returns): returns screen and process dialog`
4. Scan returns: barcode input (camera or keyboard wedge), sound feedback, bulk restock/damaged → commit `feat(returns): barcode scan returns`
5. Exchanges: `GET /orders/:id/exchange-prefill` (`eligible:false, reason` unless the adapter's `supportsExchange`), linked exchange order/parcel, exchange + process-return → commit `feat(returns): exchanges as linked parcels`

**Deliverables**
- Plugin `plugins/returns` (server + dashboard), endpoints above, event definition, timeline entries and comments.

**Acceptance criteria**
- [ ] A returned parcel appears under To process; after processing it moves to Processed and cannot be processed twice.
- [ ] Dialog enforces damaged ≤ returned, shows the live split, and "didn't arrive" units are recorded as missing (stay counted with the carrier, not in stock).
- [ ] Processing emits exactly one `ReturnProcessed` with per-line `{productId, variantId, restockQty, damagedQty, missingQty}`; body matches `POST /orders/returns/process/:id { products:[{productId, variantId, totalQuantity, damageQuantity}] }`.
- [ ] Team notes appear in the order comments/timeline.
- [ ] Scanning a barcode opens the matching return and plays a sound; bulk restock/damaged applies to every scanned return.
- [ ] Exchange is offered only for carriers whose adapter reports exchange support; otherwise prefill returns `eligible:false` and the UI shows the reason.
- [ ] Exchange order and original are linked both ways (`exchangeOfOrderId`, `exchangeSiblingOrderId`) and process-return works from the exchange.

**Verification**
- Unit: quantity split math, eligibility. Integration: process endpoint + event payload against test Postgres.
- Browser: Returns screen and dialog vs Tassyir "Returns" capture and second-pass "Process return".
- Multi-tenant: list, scan and process cannot touch another business's orders; barcode lookup is tenant-scoped.

**Out of scope**
- Stock/damaged movements and return-fee posting (P6.S1 / P6.S3 subscribe to the event); carrier-side exchange calls (supplied by P5.S4–S7 adapters).

**Kickoff prompt**
```
You are running session P5.S3 "Returns & exchanges" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s3-returns from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P5.S4 — Yalidine-family adapter

| Field | Value |
|---|---|
| **Goal** | Adapter for the Yalidine platform (Yalidine, Economiqua, Goupex, WeCan…) with webhook status sync, price sync and exchange. |
| **Branch** | `feat/p5-s4-yalidine` |
| **GitHub issue** | `P5.S4 Yalidine-family adapter` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P5.S2 |
| **Parallel-safe** | Yes with P5.S3, S5–S7. Owns `plugins/carrier-yalidine/**`. |
| **Model / size** | Sonnet · M |
| **External needs** | 🔑 Yalidine API ID + token. Until provided: contract-test mock server with recorded fixtures. |

**Inventory rows covered**
- Connect carrier from catalogue: Yalidine platform (Yalidine, Economiqua, Goupex, WeCan…) — *adapter part*
- Dispatch to carrier API, tracking number back, carrier rejection reason — *Yalidine family*
- Status sync from carriers (webhook/polling) — *webhook part*
- Delivery pricing options … sync defaults from carrier — *Yalidine price sync, keeps overrides*
- Carrier connect forms: credentials per carrier — *API ID, Token, Webhook secret, departure wilaya*
- Exchanges limited to carriers that support them — *Yalidine family supports*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P5.S1.md`, `P5.S2.md`
- `docs/research/second-pass.md`: "Carriers (connect forms)" (Yalidine row; webhook event `parcel_status_updated`), "Other order actions" (Exchange)
- `docs/research/api-surface.md`: "Delivery" (`/delivery-fees/agent/:id/sync-default`); `docs/research/dashboard-captures.md`: "Delivery & Shipping" (pricing options)

**High-level plan**
1. Config schema (API ID, Token, Webhook secret, departure wilaya, common fields) and credential validation call → commit `feat(carrier-yalidine): connect form and credential validation`
2. createParcels / cancel / validate / labels with the platform's parcel payload (commune, stop-desk, COD amount, opening note) and mapped rejection reasons → commit `feat(carrier-yalidine): dispatch, cancel, validate and labels`
3. InboundWebhookHandler for parcel_status_updated registered on the P1.S6 gateway (/webhooks/yalidine/:accountKey; verify the webhook secret, eventKey = carrier event id or body hash), processed by the shared applyParcelEvent; status mapping to normalized statuses → commit `feat(carrier-yalidine): webhook and status mapping`
4. Price sync via adapter `syncPrices` preserving overrides; exchange support → commit `feat(carrier-yalidine): price sync and exchange`
5. Mock server + recorded-fixture contract tests for every adapter method → commit `test(carrier-yalidine): contract tests against mock`

**Deliverables**
- Plugin `plugins/carrier-yalidine` registering the family (Yalidine, Economiqua, Goupex, WeCan presets), gateway handler, mock server, fixtures.

**Acceptance criteria**
- [ ] Contract suite passes for credential validation, create, cancel, validate, labels, status mapping, price sync and exchange against the mock.
- [ ] A webhook with bad secret/signature is rejected (401) and logged without the secret; valid events update the right tenant's parcel and emit `ParcelStatusChanged` once even on replay.
- [ ] Every raw Yalidine status maps to a normalized status (table-driven test); unknown raw statuses are kept as the raw label without crashing.
- [ ] Price sync fills carrier prices but leaves manual overrides untouched.
- [ ] Credentials stay encrypted and masked; auth failure surfaces as `carrierAuthFailed`, HTTP 429 as `carrierRateLimited`.
- [ ] `supportsExchange` is true, so exchange prefill is eligible for these accounts.
- [ ] Replaying the same webhook 5 times yields one parcel_event; an older event after a newer one is ignored.

**Verification**
- Unit: mapper, signature check, payload builder. Integration: contract suite plus dispatch→webhook→delivered on the mock.
- Browser: connect form and dispatch toast vs Tassyir "Carriers (connect forms)"; with real credentials (when supplied) run a sandbox dispatch.
- Multi-tenant: a webhook for business A's account cannot alter business B's parcel even with a colliding tracking number.

**Out of scope**
- Other carriers; tracking UI (P5.S2); cash payouts (P6.S3).

**Kickoff prompt**
```
You are running session P5.S4 "Yalidine-family adapter" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s4-yalidine from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P5.S5 — Ecotrack-family adapter

| Field | Value |
|---|---|
| **Goal** | Adapter for the Ecotrack platform (Ecotrack generic, DHD, Anderson, TSL, Navex, 48HR…) with polling status sync, validate-on-dispatch, price sync and exchange. |
| **Branch** | `feat/p5-s5-ecotrack` |
| **GitHub issue** | `P5.S5 Ecotrack-family adapter` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P5.S2 |
| **Parallel-safe** | Yes with P5.S3, S4, S6, S7. Owns `plugins/carrier-ecotrack/**`. |
| **Model / size** | Sonnet · M |
| **External needs** | 🔑 Ecotrack token. Until provided: contract-test mock server. |

**Inventory rows covered**
- Connect carrier from catalogue: Ecotrack platform (DHD, Anderson, TSL, Navex, 48HR…) — *adapter part*
- Dispatch to carrier API, tracking number back, carrier rejection reason — *Ecotrack family*
- Status sync from carriers (webhook/polling) — *polling part*
- Delivery pricing options … sync defaults from carrier — *Ecotrack price sync, keeps overrides*
- Carrier connect forms: … Token/Base URL for Ecotrack — *this family*
- Exchanges limited to carriers that support them — *Ecotrack supports*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P5.S1.md`, `P5.S2.md`
- `docs/research/second-pass.md`: "Carriers (connect forms)" (Ecotrack rows; polling inferred), "Storefront order → delivered" order-record fields (`lastCheckedAt`, `nextCheckAt`, `carrierDeletedAt`)
- `docs/research/dashboard-captures.md`: "Delivery & Shipping" (picker entries tagged Ecotrack)

**High-level plan**
1. Config schemas (generic: Token + Base URL; branded: Token with preset base URL) and credential check → commit `feat(carrier-ecotrack): connect forms and validation`
2. createParcels / cancel / validate-on-dispatch (honors auto-validate; otherwise awaiting validation) / labels → commit `feat(carrier-ecotrack): dispatch, validate and labels`
3. Polling via the carrier-poll-tick scheduled task (every 5 min) enqueuing per-account batches on carrier-polling; poll results converted to the same normalised event and applied by the shared applyParcelEvent; batches parcels due by `nextCheckAt`, updates `lastCheckedAt`, backoff, per-account rate limiting; status mapping → commit `feat(carrier-ecotrack): polling job and status mapping`
4. Price sync (keeps overrides) and exchange support → commit `feat(carrier-ecotrack): price sync and exchange`
5. Mock server + fixtures contract tests → commit `test(carrier-ecotrack): contract tests against mock`

**Deliverables**
- Plugin `plugins/carrier-ecotrack` registering the family and brand presets, polling processor, mock server, fixtures.

**Acceptance criteria**
- [ ] Contract suite passes for every adapter method against the mock.
- [ ] With auto-validate off, parcels stay Awaiting validation until validated; with it on they ship immediately.
- [ ] Polling selects only parcels past `nextCheckAt`, skips terminal statuses, stops for undispatched/deleted parcels (`carrierDeletedAt`), and emits `ParcelStatusChanged` once per real change.
- [ ] Mapper is table-driven and tolerant of unknown raw statuses.
- [ ] Brand presets (DHD, Anderson, TSL, Navex, 48HR) need only a Token; generic Ecotrack needs Token + Base URL.
- [ ] Token never appears in logs; auth and rate-limit errors map to `carrierAuthFailed` / `carrierRateLimited`; `supportsExchange` is true.

**Verification**
- Unit: mapper, backoff schedule. Integration: polling processor against the mock with controlled time; dispatch→poll→delivered path.
- Browser: connect form and Tracking refresh vs Tassyir carrier forms and Tracking.
- Multi-tenant: each account is polled with its own credentials; business A's parcel is never updated from business B's responses.

**Out of scope**
- Other carriers; tracking UI beyond the existing refresh hook.

**Kickoff prompt**
```
You are running session P5.S5 "Ecotrack-family adapter" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s5-ecotrack from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S5.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P5.S6 — Carriers: ZR Express, NOEST, Maystro

| Field | Value |
|---|---|
| **Goal** | Three adapters: ZR Express (volumetric allowance, exchange), NOEST, and Maystro (product sync). |
| **Branch** | `feat/p5-s6-carriers-a` |
| **GitHub issue** | `P5.S6 Carriers: ZR Express, NOEST, Maystro` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P5.S2 |
| **Parallel-safe** | Yes with P5.S3–S5, S7. Owns `plugins/carrier-zr/**`, `plugins/carrier-noest/**`, `plugins/carrier-maystro/**`. |
| **Model / size** | Sonnet · L (three adapters; if the context runs short, finish ZR + NOEST and hand Maystro off as P5.S6b per the mutation protocol) |
| **External needs** | 🔑 per carrier (ZR API key/ID, NOEST GUID/token, Maystro token). Mock servers until provided. |

**Inventory rows covered**
- Connect carrier from catalogue: Maystro, ZR Express, NOEST — *adapter part*
- Dispatch to carrier API, tracking number back, carrier rejection reason — *these three*
- Status sync from carriers (webhook/polling) — *these three, mechanism per carrier API*
- Carrier connect forms: … API key/ID for ZR; GUID/Token for NOEST… — *ZR volumetric allowance; Maystro Token without auto-validate*
- Exchanges limited to carriers that support them — *ZR supports*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P5.S1.md`, `P5.S2.md`
- `docs/research/second-pass.md`: "Carriers (connect forms)" (ZR, NOEST, Maystro rows; overweight/volumetric)
- `docs/research/data-model.md`: "Product" (`maystroProductId`, `zrProductId` on variants); `docs/research/dashboard-captures.md`: "Delivery & Shipping"

**High-level plan**
1. ZR Express adapter: schema (API key, API ID, overweight + volumetric allowance), dispatch, status, labels, exchange → commit `feat(carrier-zr): zr express adapter`
2. NOEST adapter: schema (GUID, Token), dispatch, status sync, labels → commit `feat(carrier-noest): noest adapter`
3. Maystro adapter: Token only (no auto-validate), product sync storing `maystroProductId`, dispatch, status → commit `feat(carrier-maystro): maystro adapter with product sync`
4. Status/error mapping tables for all three, feeding the dispatch taxonomy → commit `feat(carriers): status and error mapping for zr, noest, maystro`
5. Mock servers and contract tests for each → commit `test(carriers): contract tests for zr, noest, maystro`

**Deliverables**
- Three plugins (one system each), mock servers, fixtures; Maystro product-sync job; `zrProductId` / `maystroProductId` stored on variants via an append-only extension of the product model.

**Acceptance criteria**
- [ ] Contract suites pass for all three on every method they support; unsupported capabilities are declared in `capabilities`, not stubbed.
- [ ] ZR volumetric allowance is used in the overweight computation (test: volumetric weight above real weight changes the fee).
- [ ] Maystro form has no "validate automatically" toggle; a product synced once reuses its stored `maystroProductId` on later dispatches.
- [ ] ZR reports `supportsExchange` true; NOEST and Maystro report false, so exchange prefill is ineligible for them.
- [ ] Credentials encrypted, masked and never logged; failures map to the dispatch taxonomy.

**Verification**
- Unit: mappers, volumetric math, product-sync idempotence. Integration: dispatch→status→delivered on each mock.
- Browser: three connect forms vs Tassyir "Carriers (connect forms)".
- Multi-tenant: product sync and status handling stay within the owning business.

**Out of scope**
- Yalidine/Ecotrack (P5.S4/S5), other carriers (P5.S7), cash payouts (P6.S3).

**Kickoff prompt**
```
You are running session P5.S6 "Carriers: ZR Express, NOEST, Maystro" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S6), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s6-carriers-a from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S6.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P5.S7 — Carriers: Elogistia, Ecom Delivery, Zimou, Osen

| Field | Value |
|---|---|
| **Goal** | Four adapters: Elogistia, Ecom Delivery V2 (exchange), Zimou Express (webhook URL after connect, parcel opening), Osen Express (parcel opening). |
| **Branch** | `feat/p5-s7-carriers-b` |
| **GitHub issue** | `P5.S7 Carriers: Elogistia, Ecom Delivery, Zimou, Osen` (label `phase-5`, milestone `P5 Delivery`) |
| **Prerequisites** | P5.S2 |
| **Parallel-safe** | Yes with P5.S3–S6. Owns `plugins/carrier-elogistia/**`, `plugins/carrier-ecom/**`, `plugins/carrier-zimou/**`, `plugins/carrier-osen/**`. |
| **Model / size** | Sonnet · L (four adapters; if the context runs short, finish two and hand the rest off as P5.S7b per the mutation protocol) |
| **External needs** | 🔑 per carrier (Elogistia API key; Ecom API key + token; Zimou token; Osen token). Mock servers until provided. |

**Inventory rows covered**
- Connect carrier from catalogue: Elogistia, Ecom Delivery, Zimou, Osen — *adapter part*
- Dispatch to carrier API, tracking number back, carrier rejection reason — *these four*
- Status sync from carriers (webhook/polling) — *Zimou webhook; others as their API allows*
- Carrier connect forms: … (Elogistia API key; Ecom API key + Token; Zimou Token + webhook URL shown after connect; Osen Token + "Customer may open the parcel" Allow / Don't allow)
- Exchanges limited to carriers that support them — *Ecom Delivery supports*

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P5.S1.md`, `P5.S2.md`
- `docs/research/second-pass.md`: "Carriers (connect forms)" (Elogistia, Ecom Delivery V2, Zimou, Osen rows), "Other order actions" (Exchange)
- `docs/research/dashboard-captures.md`: "Delivery & Shipping"

**High-level plan**
1. Elogistia adapter (API key): dispatch, status, labels → commit `feat(carrier-elogistia): elogistia adapter`
2. Ecom Delivery V2 adapter (API key + token) with exchange support → commit `feat(carrier-ecom): ecom delivery adapter with exchange`
3. Zimou adapter: token, per-account gateway URL `/webhooks/zimou/:accountKey` (an `InboundWebhookHandler` on the P1.S6 gateway) shown after connect, parcel-opening flag in payload → commit `feat(carrier-zimou): zimou adapter and webhook`
4. Osen adapter: token, Allow / Don't allow parcel-opening setting → commit `feat(carrier-osen): osen adapter`
5. Mock servers and contract tests for all four → commit `test(carriers): contract tests for elogistia, ecom, zimou, osen`

**Deliverables**
- Four plugins, mock servers, fixtures, Zimou gateway handler and the per-account webhook URL surfaced in the connect result.

**Acceptance criteria**
- [ ] Contract suites pass for each adapter on every method it declares.
- [ ] After connecting Zimou the UI shows its unique, copyable webhook URL; events to it update only that account's parcels; events for unknown accounts or without valid proof are rejected.
- [ ] Osen's setting changes the parcel-opening value sent on dispatch; Zimou honors the order's parcel-opening policy.
- [ ] Only Ecom Delivery among these four reports `supportsExchange` true.
- [ ] Credentials encrypted and masked; failures map to the dispatch taxonomy.

**Verification**
- Unit: mappers, payload builders, webhook account resolution. Integration: dispatch→status→delivered on each mock.
- Browser: four connect forms (incl. Zimou post-connect webhook display, Osen Allow/Don't allow) vs Tassyir "Carriers (connect forms)".
- Multi-tenant: webhook URLs are per account and cannot be replayed against another business.

**Out of scope**
- Other families (P5.S4–S6); payouts (P6.S3).

**Kickoff prompt**
```
You are running session P5.S7 "Carriers: Elogistia, Ecom Delivery, Zimou, Osen" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P5-delivery.md (section P5.S7), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p5-s7-carriers-b from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P5.S7.md` → commit → push → `gh pr create` → report PR link → stop.
