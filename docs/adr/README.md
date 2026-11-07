# Architecture Decision Records

Nygard format (Status, Context, Options, Decision, Consequences, plus **Evidence** for spike-backed ADRs). Drafts that fed these ADRs stay in [drafts/](drafts/). Spike definitions and the full session plan: [../roadmap/plans/P0.S2a-plan.md](../roadmap/plans/P0.S2a-plan.md).

Status `Proposed` until the user approves in PR review; then the session flips it to `Accepted (date)` (shared plan, Task 11).

| ADR | Title | Status | Gating spike | Spike result | Written in |
|---|---|---|---|---|---|
| [0001](0001-repo-layout-and-upstream.md) | Repo layout and upstream (published `@vendure/*`, clean repo) | Proposed — user confirms | — (Node 24 + pnpm smoke) | pass (Node 24.22.1 boot; pnpm 10 needs `onlyBuiltDependencies` + explicit `typeorm`) | P0.S2a-1 |
| [0002](0002-tenancy.md) | Tenancy: Business → Stores on Vendure Channels | Proposed — evidence pending | C channels at scale | **pending P0.S2a-2** | P0.S2a-1 (pre-spike) |
| [0003](0003-ids.md) | Ids: Vendure defaults for core, snowflake strings for ours | Proposed | — | — | P0.S2a-1 |
| [0004](0004-pricing-engine-and-order-totals.md) | Pricing engine and order totals (signed quote) | Proposed | B order totals | pass (total 9 100 DZD exact, precision 0) | P0.S2a-1 |
| [0005](0005-i18n.md) | i18n: dashboard ar/en RTL, storefront ar/fr/en | Proposed | — | — | P0.S2a-1 |
| [0006](0006-storefront-architecture.md) | Storefront: Next.js 16 multi-tenant by host | Proposed — evidence pending | F shared cache handler | **pending P0.S2a-3** | P0.S2a-1 (pre-spike) |
| [0007](0007-branding.md) | Branding: neutral placeholder, banned reference names | Proposed | — | — | P0.S2a-1 |
| [0008](0008-auth.md) | Authentication and authorization surfaces | Proposed | A (token type) | pass (dashboard sends Bearer with `['cookie','bearer']`) | P0.S2a-1 |
| [0009](0009-order-lifecycle.md) | COD order lifecycle on Vendure | Proposed | B order process | pass (Pending/Confirmed/Scheduled/Returned; settle on Delivered) | P0.S2a-1 |
| [0010](0010-merchant-dashboard-host.md) | Merchant dashboard host | Proposed — user confirms | A dashboard extensions | pass → Option 1 (RTL partial, CSS-fixable) | P0.S2a-1 |
| 0011 | Hosting provider and regions | not written | G latency | pending P0.S2a-3 | P0.S2a-3 |
| 0012 | Edge, TLS and custom domains | not written | — | — | P0.S2a-3 |
| 0013 | Process model, job queues and scheduler | not written | D PgBouncer | pending P0.S2a-2 | P0.S2a-2 |
| 0014 | Search | not written | E Arabic search | pending P0.S2a-3 | P0.S2a-3 |
| 0015 | Observability | not written | — | — | P0.S2a-3 |
| 0016 | Data lifecycle, outbox, partitioning, pooling | not written | D PgBouncer | pending P0.S2a-2 | P0.S2a-2 |

All P0.S2a-1 spikes ran on **SQLite** (Docker unavailable on the machine: Windows "Virtual Machine Platform" off). Spikes A/B test extension APIs and order math, which are database-independent; Postgres-specific behaviour (order-number counter under concurrency) is re-checked in P0.S2a-2.

## Decisions that change later briefs

Start from [../architecture/roadmap-impact.md](../architecture/roadmap-impact.md) (already applied). New items from P0.S2a-1, to apply in a `docs/roadmap-<change>` PR:

| Decision | ADR | Brief / section to edit |
|---|---|---|
| Money stored with precision 0 for DZD (custom `MoneyStrategy`; 9 100 DZD stored as 9100) | 0004 | P2.S4 pricing, P3.S4 intake, P6 finance briefs: "integer DZD" wording stays, add "precision 0 money strategy (ADR 0004)" |
| Order number = `Order.customFields.orderNumber` from a per-business counter assigned on entering `Pending` (not `OrderCodeStrategy`) | 0009 | P1.S1 "order number sequence service" contract, P3.S4, P4.S5 |
| Intake must run in one DB transaction (payment added outside the API's request handling) | 0009 | P3.S4 intake steps |
| Vendure's built-in cancel zeroes line quantities; restore needs our guard; default check `checkAllItemsBeforeCancel` disabled | 0009 | P4.S1 order process |
| pnpm 10: `onlyBuiltDependencies` (bcrypt, better-sqlite3/pg natives, esbuild, sharp, re2) + explicit `typeorm` dependency | 0001 | P0.S2b step 1 |
| Dashboard nav per user via 3.8 per-user visibility (`ctx.hasPermissions`), custom `PlatformStaff` permission | 0010 | P1.S5 admin shell |
| Dashboard auth: Vendure session token, `tokenMethod: ['cookie','bearer']` (no custom JWT) | 0008 | P1.S2 auth brief "JWT" wording |
