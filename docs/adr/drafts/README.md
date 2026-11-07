# ADR drafts (input for P0.S2a)

These are **drafts** written by the architecture pass on 2026-11-07. P0.S2a owns `docs/adr/`. It runs the spikes, edits these drafts with evidence, renames them to `docs/adr/NNNN-<slug>.md`, sets the status to *accepted* after the user's review, and writes the ADRs not drafted here (0003 ids, 0005 i18n, 0007 branding).

Every draft uses the Nygard format: Status, Context, Options, Decision, Consequences.

| ADR | Title | Status | Gating spike (P0.S2a) |
|---|---|---|---|
| [0001](0001-repo-layout-and-upstream.md) | Repo layout and upstream: published `@vendure/*` packages in a clean repo | proposed | none (user confirms) |
| [0002](0002-tenancy.md) | Tenancy: Business → Stores on Vendure Channels | proposed | C channels at scale |
| [0004](0004-pricing-engine-and-order-totals.md) | Pricing engine and order totals (signed quote) | proposed | B order totals |
| [0006](0006-storefront-architecture.md) | Storefront: Next.js 16 multi-tenant by host | proposed | F shared cache handler |
| [0008](0008-auth.md) | Authentication and authorization surfaces | proposed | A (dashboard token type) |
| [0009](0009-order-lifecycle.md) | COD order lifecycle on Vendure | proposed | B order process |
| [0010](0010-merchant-dashboard-host.md) | Merchant dashboard host | proposed | A dashboard extensions |
| [0011](0011-hosting-and-regions.md) | Hosting provider and regions | proposed | G latency (before P10.S3) |
| [0012](0012-edge-tls-custom-domains.md) | Edge, TLS and custom domains | proposed | — (staging test in P8.S9) |
| [0013](0013-process-model-job-queues-scheduler.md) | Process model, job queues and scheduler | proposed | D (scheduler lock via pooler) |
| [0014](0014-search.md) | Search | proposed | E Arabic search |
| [0015](0015-observability.md) | Observability | proposed | — |
| [0016](0016-data-lifecycle-outbox-partitioning.md) | Data lifecycle: outbox, inbound webhooks, partitioning, indexes, migrations, pooling | proposed | D PgBouncer |

Spike definitions: `../../architecture/roadmap-impact.md` → "P0.S2a".
