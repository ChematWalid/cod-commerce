# P7 — Analytics & home

**Phase goal:** reports, the home dashboard and notifications, all computed from the order, parcel and wallet data built in P4–P6.
**Exit criteria:** Home KPIs and Needs-you match seeded data; reports export; notifications fire per order event.

**Session order / lanes:** P7.S1 (analytics, after P6.S3 because the carriers report shows cash held) and P7.S3 (notifications) are independent lanes and can run in parallel, and both can run next to any P8 session; P7.S1 can also run next to P6.S4. P7.S2 (home) starts after P7.S1, P6.S3 and P6.S4 are merged because it reuses the analytics aggregates, wallet data and buy-price data; it can run next to P7.S3. The only shared edits are one registration line per plugin in the server config and one navigation entry per plugin in the dashboard (append only; on conflict keep both lines). `packages/shared/events` is read-only here except for appending new events.

Common to all three briefs: every endpoint is scoped by `businessId` (+ `storeId` filter) through the tenant guard; money follows the P6 convention (DZD); dates use the business timezone; dashboard text is i18n (EN/AR, RTL-safe); no Tassyir name, logo or copy appears in our UI.

---

## P7.S1 — Analytics overview & reports

| Field | Value |
|---|---|
| **Goal** | Ship the Analytics section: overview KPIs with period comparison, daily stage chart, funnel and cancel reasons, four drill-down reports with export, and store-visitor analytics. |
| **Branch** | `feat/p7-s1-analytics` |
| **GitHub issue** | `P7.S1 Analytics overview & reports` (label `phase-7`, milestone `P7 Analytics & home`) |
| **Prerequisites** | P5.S2 (tracking/parcels), P4.S4 (assignment/team data), P3.S4 (visitor tracking), P6.S3 (carrier cash held / collections). |
| **Parallel-safe** | Yes — with P7.S3, P6.S4 and all P8 sessions. Owns `plugins/analytics/**` and the `/analytics/**` dashboard routes. Reads (never edits) order, parcel, wallet and visitor tables. |
| **Model / size** | Sonnet · L |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Overview: date range + comparison period, store filter; KPIs orders placed, confirmation rate, delivery rate, delivered sales, average delivered order
- Daily orders by current stage (delivered, returned, on the way, to ship, to confirm, cancelled)
- Funnel and "where orders are lost" (cancel reasons)
- Reports with export, compare and drill-down to filtered lists: products, wilayas, carriers (days to deliver, cash held), team (time to confirm, delivered share)
- Store visitors analytics
- Team stats report and commissions — stats part only (commission configs are P1.S4)
- Not this session: Marketing tab (P9.S4; leave an empty tab stub) and AI questions (P9.S7a; leave hidden buttons "Why did my numbers change?" / "Where am I losing orders?" behind a named extension point `analytics.aiQuestions`).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; `docs/roadmap/handoff/P5.S2.md`, `P4.S4.md`, `P3.S4.md`, `P6.S3.md` (held-cash service to reuse, not recompute)
- `docs/research/dashboard-captures.md` → "Analytics `/analytics`", "Reports" (column list per report), "Team"
- `docs/research/api-surface.md` → "Analytics" (`/analytics/overview`, `/analytics/cancel-reasons`, `/live/snapshot`)
- `docs/research/data-model.md` → "Order (dashboard)" for status fields and timestamps
- ADRs on tenancy and domain events in `docs/adr/`; ADR 0016 (outbox consumers, §7 read-replica routing) and the P1.S6 handoff (outbox consumer registry)

**High-level plan**
1. Define metric semantics in `packages/shared` (what "placed", "confirmed", "finished", "delivered" and "current stage" mean; confirmation rate = confirmed/placed, delivery rate = delivered/finished) with unit tests on a fixture → commit `feat(analytics): metric definitions and fixtures`
2. Aggregation layer: SQL views or materialized daily rollups per store/stage/product/wilaya/carrier/agent, upserted incrementally by the analytics queue from outbox events and recomputed nightly for the last 3 days by the analytics-rollup scheduled task; heavy report queries use the read-replica repository when DATABASE_REPLICA_URL is set (ADR 0016 §7); indexes; period + comparison query helper → commit `feat(analytics): aggregates and rollup job`
3. API: overview (KPIs + previous-period values), daily stage series, funnel, cancel-reasons, four reports (value, "before", change) and CSV/XLSX export → commit `feat(analytics): overview and report endpoints`
4. Dashboard Overview screen: date presets, compare toggle, store filter, KPI cards with deltas, stacked daily chart, funnel, "Where orders are lost" → commit `feat(analytics): overview screen`
5. Report screens (products, wilayas, carriers, team): top-10 chart, table with before + Change, Export, Open → pre-filtered orders/tracking list (query filters agreed with P4.S2/P5.S2) → commit `feat(analytics): report screens with export and drill-down`
6. Visitor analytics (visitors, sessions, conversion, top pages/sources from P3.S4 tracking) behind the "View visitors" permission; Marketing tab stub and AI-question extension point → commit `feat(analytics): visitors analytics and stubs`
7. Tenant-isolation and performance tests (10k-order fixture, query time budget) → commit `test(analytics): isolation and performance`

**Deliverables**
- `plugins/analytics`: rollup views/entities and migrations, BullMQ job, resolvers/controllers, permissions "View analytics" and "View visitors" registered in the P1.S3 catalog, dashboard extension, export service; fixtures in `packages/shared`.

**Acceptance criteria**
- [ ] On a seeded dataset each KPI equals the hand-computed value; the comparison period shows the previous value and percentage change.
- [ ] The daily chart puts every order in exactly one current stage (Delivered, Returned, On the way, To ship, To confirm, Cancelled); the buckets sum to orders placed.
- [ ] Funnel shows Orders → Confirmed % → Delivered % → Sales → Average; "Where orders are lost" lists cancel reasons with counts and shares.
- [ ] Each report has the column set from the captures (carriers include Days to deliver and Cash held; team includes Time to confirm or cancel and Delivered share), a top-10 chart, "before" and Change columns, and Export returns the same rows.
- [ ] "Open" on a row lands on the orders or tracking list already filtered by that product/wilaya/carrier/agent and the same date range.
- [ ] Store filter and "All stores" both work; a user without access to a store never sees its numbers.
- [ ] Visitors analytics is hidden without the permission; Marketing tab exists but is empty; AI buttons are inactive.
- [ ] Overview answers in under 1 s on the 10k-order fixture.

**Verification**
- Unit tests for metric functions and period helper; integration tests for every endpoint against test Postgres.
- Browser check of `/analytics` and each `/analytics/reports/*` against the "Analytics" and "Reports" notes in `dashboard-captures.md`; screenshots in the PR, including RTL.
- Multi-tenant: businesses A and B with overlapping dates; B's token never returns A's rows (overview, reports, export, visitors).

**Out of scope**
- Marketing tree and ad spend (P9.S4); AI answers (P9.S7a); home dashboard (P7.S2); profit report (P6.S4).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P7.S1 "Analytics overview & reports" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P7-analytics-home.md (section P7.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p7-s1-analytics from an up-to-date phase/P7 (PR into phase/P7, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P7.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P7.S2 — Home dashboard & onboarding

| Field | Value |
|---|---|
| **Goal** | Build the Home screen: today KPIs, Needs-you queue, money on the way, wilaya map, last 7 days, next-step nudges, plus the onboarding checklist and Example data on empty accounts. |
| **Branch** | `feat/p7-s2-home` |
| **GitHub issue** | `P7.S2 Home dashboard & onboarding` (label `phase-7`, milestone `P7 Analytics & home`) |
| **Prerequisites** | P7.S1, P6.S3 (carrier cash/collections), P6.S4 (buy-price data and missing-cost checks for nudges); P5.S3 (returns) and P3.S4 (abandoned checkouts) are merged transitively. |
| **Parallel-safe** | Yes — with P7.S3 and P8 sessions. Owns `plugins/home/**` and the dashboard root (Home) route. Uses `plugins/analytics` only through its exported service. |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Today KPIs: orders today (Δ vs yesterday same time), confirmed (%), returned today, delivered today
- "Needs you" action queue with deep links: to call, confirmed not dispatched, parcels not moving, cash held by carrier with no payout for N days, returns to process, abandoned checkouts today
- Money on the way: cash held per carrier (overdue flag, parcel count), parcels still on the road
- Today on the map (orders by wilaya)
- Last 7 days summary (total/confirmed/delivered/cancelled)
- Next steps nudges (e.g. products with no buy price)
- Onboarding checklist on Home (add product → connect carrier → test order → confirm) + "Example" data on empty dashboard

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P7.S1`, `P6.S3`, `P6.S4`, `P5.S3`, `P3.S4`
- `docs/research/second-pass.md` → "Onboarding (new account)" and "Home after activity"
- `docs/research/dashboard-captures.md` → "Home `/dashboard/:id`" (deep-link targets and `/home?storeId` payload)
- `docs/research/api-surface.md` → "Analytics"; `docs/research/data-model.md` → "Order (dashboard)"

**High-level plan**
1. `GET /business/:id/home?storeId` aggregate: today vs same-time-yesterday KPIs and last-7-days totals → commit `feat(home): today and weekly kpi endpoint`
2. Needs-you counters + deep-link descriptors (orders `tab=to-confirm`, `tab=ready`, tracking `late=1`, Record collection, returns, `status=abandoned&date`), configurable payout threshold N days → commit `feat(home): needs-you queue`
3. Money on the way (held cash per carrier, overdue flag, parcel count, on-the-road totals) with Record collection wired to P6.S3 → commit `feat(home): money on the way`
4. Wilaya choropleth (58-wilaya SVG in `packages/shared`, low→high legend, "X leads with N orders") and Last 7 days card linking to Analytics → commit `feat(home): map and last 7 days`
5. Onboarding state derived from data (product exists, carrier connected, test order placed, order confirmed): "N of 4", Hide for now (persisted per user), "Your store is ready" with store link + Copy → commit `feat(home): onboarding checklist`
6. Example data: greyed placeholders labelled "Example" until real orders exist; Next-steps nudge registry (no buy price, Meta Ads not connected stub, others later) → commit `feat(home): example data and nudges`
7. Tests and screenshots → commit `test(home): seeded dataset and isolation`

**Deliverables**
- `plugins/home` (service, endpoint, permission-aware widgets, Home screen, onboarding-state entity), SVG map asset, EN/AR strings.

**Acceptance criteria**
- [ ] Orders today shows its delta against the same time yesterday in the business timezone.
- [ ] Each Needs-you row count equals the seeded fixture and its link opens the target list with matching filters; with nothing pending the empty state says every order is called and everything confirmed has shipped.
- [ ] "DZD X held by carrier, no payout for N days" appears only past the threshold and opens Record collection.
- [ ] Money on the way lists each carrier with held amount, parcel count and overdue flag; the on-the-road total matches in-transit parcels.
- [ ] The map shades wilayas by today's orders and names the leader.
- [ ] A new account shows the checklist at 0 of 4 with a CTA per step; steps tick automatically as data appears; after step 4 "Your store is ready" with a copyable store link replaces it; Hide for now persists.
- [ ] Empty accounts show greyed Example data that disappears once real orders exist.
- [ ] Widgets respect permissions and store access (a member without finance rights does not see Money on the way).

**Verification**
- Unit tests for delta math and onboarding derivation; integration test for the home endpoint over a seeded day.
- Browser check of Home on an empty and an active account against "Home `/dashboard/:id`", "Onboarding" and "Home after activity"; RTL screenshot.
- Multi-tenant: data in a second business never changes the first's counts; store filter honours store access.

**Out of scope**
- Notification bell (P7.S3); Meta/TikTok connect flows (P9.S3/S4; nudges only link); profit logic (P6.S4).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P7.S2 "Home dashboard & onboarding" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P7-analytics-home.md (section P7.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p7-s2-home from an up-to-date phase/P7 (PR into phase/P7, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P7.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P7.S3 — Notifications centre & preferences

| Field | Value |
|---|---|
| **Goal** | Deliver in-app, email and browser-push notifications for order events with per-user preferences. |
| **Branch** | `feat/p7-s3-notifications` |
| **GitHub issue** | `P7.S3 Notifications centre & preferences` (label `phase-7`, milestone `P7 Analytics & home`) |
| **Prerequisites** | P1.S2 (accounts/account menu), P4.S4 (assignment events), P4.S5 (spam daily summary), P5.S2 (courier notes, delivered/returned events); P4.S1 order events and P3.S4 abandoned checkouts are merged transitively. |
| **Parallel-safe** | Yes — with P7.S1, P7.S2 and P8 sessions. Owns `plugins/notifications/**`, the bell component, `/notifications` and the account-menu "Notification settings" route. Only subscribes to events. |
| **Model / size** | Sonnet · M |
| **External needs** | Web Push VAPID keys (generated by a script, kept in `.env`, placeholders in `.env.example`); SMTP via Mailpit locally. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`):
- Notifications centre (bell, mark read)
- Notification feed entries per order event
- Courier notes surfaced as notifications — notify part only (capture is P5.S2)
- Account menu: Profile (photo, name, phone), Security (change password), Notification settings (browser push permission, per-event Email/Push toggles for new order, delivered, confirmed, dispatched, returned, cancelled, abandoned checkout, delivery note, assigned to me, scheduled, business updates; Send test), Language, Light/Dark theme — Notification settings part only (profile/security P1.S2, language/theme P1.S5)
- Spam daily summary (20:00) — delivery through this channel only (rules and settings are P4.S5)

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P4.S1`, `P4.S4`, `P4.S5` (daily-summary event), `P5.S2`, `P1.S2`
- `docs/feature-inventory.md` section 1 (Notifications centre) and section X (Account menu, Notification feed)
- `docs/research/dashboard-captures.md` → "Sidebar", "Store settings" (Spam protection daily summary); `docs/research/second-pass.md` → "Storefront order → delivered (full lifecycle…)" and "Other order actions" for each event's wording
- `packages/shared/events` (event list); ADRs on events and queues

**High-level plan**
1. `Notification` entity (businessId, storeId, userId, type, params, readAt, link) and `NotificationPreference` (user × event × channel, defaults) with migration and tenant guard → commit `feat(notifications): entities and preferences`
2. Event subscribers (OrderPlaced, OrderConfirmed, OrderDispatched, OrderDelivered, OrderReturned, OrderStatusChanged to cancelled/scheduled, abandoned checkout, courier note via ParcelStatusChanged, assigned to me, business updates, spam daily summary); recipient resolution by role, store access and assignment; EN/AR templates such as "Order #… has been dispatched…" → commit `feat(notifications): event subscribers and templates`
3. BullMQ delivery workers: in-app feed, email via SMTP (Mailpit), idempotency key per event+user+channel, retry/backoff → commit `feat(notifications): delivery queue and email`
4. Browser Web Push: VAPID key script, subscription endpoint, dashboard service worker, permission flow, drop subscription on 410 → commit `feat(notifications): web push`
5. Feed API and bell (unread badge, dropdown, mark read / mark all read, `/notifications` page with deep links) → commit `feat(notifications): feed and bell ui`
6. Notification settings screen: browser permission state, per-event Email/Push matrix, Send test → commit `feat(notifications): settings and send test`
7. Tests incl. tenant isolation → commit `test(notifications): events, preferences, isolation`

**Deliverables**
- `plugins/notifications` (entities, subscribers, queue processors, API, service worker, dashboard bell/page/settings), `scripts/generate-vapid-keys`, i18n templates.

**Acceptance criteria**
- [ ] Each listed domain event creates exactly one feed entry per eligible recipient; replaying an event does not duplicate.
- [ ] Preferences gate channels: switching Email off for "delivered" sends no email; defaults cover every event in the inventory list.
- [ ] "Assigned to me" reaches only the assignee; courier notes arrive as "delivery note" entries.
- [ ] Bell shows unread count; mark read and mark all read persist; entries deep-link to the order or parcel.
- [ ] A subscribed browser receives a push for a test order; denied permission is shown correctly in settings.
- [ ] Send test produces a feed entry, an email in Mailpit and a push.
- [ ] The 20:00 spam summary is delivered through each user's preferred channels.

**Verification**
- Unit tests for recipient resolution, preference gating, templates; integration tests for event → notification flows and Mailpit delivery.
- Browser check of bell, `/notifications` and settings against the "Notifications centre" and "Account menu" notes; Web Push verified in a real Chromium profile.
- Multi-tenant: an event in business A never notifies business B users; users only read their own feed.

**Out of scope**
- WhatsApp/SMS channels (P9.S5); profile, security, language screens (P1.S2/P1.S5); spam rules (P4.S5/S6).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P7.S3 "Notifications centre & preferences" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P7-analytics-home.md (section P7.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p7-s3-notifications from an up-to-date phase/P7 (PR into phase/P7, ADR 0018), small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P7.S3.md` → commit → push → `gh pr create` → report PR link → stop.
