# Where we stopped: onboarding for the next agent (2026-11-07, after P0.S2b-3)

Read this first, then `CLAUDE.md` (session rules, mandatory) and `docs/roadmap/CONTRIBUTING.md`.

## Project in one paragraph
This is a multi-store cash-on-delivery commerce SaaS for Algeria, built on **Vendure 3.8.1** (published `@vendure/*` packages, pinned) with a Next.js 16 storefront. Work runs as roadmap sessions: **one session = one branch = one PR**. Working agreement (user, 2026-11-07): the agent squash-merges its own PR once CI is green; the user decides via multiple-choice questions. The roadmap is in `docs/roadmap/README.md`, the briefs in `docs/roadmap/P{n}-*.md`, the plans in `docs/roadmap/plans/` and the handoffs in `docs/roadmap/handoff/`.

## Progress
| Session | Issue | Branch | PR | State |
|---|---|---|---|---|
| P0.S1 Repo, GitHub & CI | #1 | — | #66, #68 | **merged** |
| Roadmap split of P0.S2a into -1/-2/-3 | — | `docs/roadmap-split-p0-s2a` | #71 | **merged** |
| **P0.S2a-1** ADRs 0001–0010 & spikes A/B | #2 | `docs/p0-s2a-adrs` | #72 | **merged**; ADRs accepted 2026-11-07 (0006 still Proposed) |
| **P0.S2a-2** Scale spikes C/D (ADRs 0002 evidence, 0013, 0016) | #69 | `docs/p0-s2a2-scale-spikes` | #73 | **merged**; ADRs accepted 2026-11-07 |
| **P0.S2a-3** Search/cache/latency spikes E/F/G (ADRs 0006 evidence, 0011, 0012, 0014, 0015) | #70 | `docs/p0-s2a3-search-cache-spikes` | #75 | **merged**; handoff `handoff/P0.S2a-3.md`; F (f)/(g) → P3.S5, G → before P10.S3 |
| **P0.S2b-1** Foundation: workspace, gates, data services, CI | #3 | `feat/p0-s2b-scaffolding` | #85 | **merged**; handoff `handoff/P0.S2b-1.md` |
| **P0.S2b-2** Server core: typed env, health probes, Vendure config per role, `integration` CI job | #79 | `feat/p0-s2b2-server-core` | #86 | **merged**; handoff `handoff/P0.S2b-2.md` |
| **P0.S2b-3** Server data & image: migrate role and seed, entry points, e2e, single image, `stack` CI job | #80 | `feat/p0-s2b3-server-data-image` | #88 | **merged**; handoff `handoff/P0.S2b-3.md`; ADR 0013 addendum (activeQueues) accepted 2026-11-07; evidence `docs/evidence/P0.S2b-3/` |
| P0.S2b-4 … -6 (dashboard, storefront, plugin template) | #81–#83 | per `P0-setup.md` split table | — | not started; plan `plans/P0.S2b-plan.md` |

**Merge order:** P0.S2a (#71–#77) and the P0.S2b split (#84) are merged. **P0.S2b runs as six sequential parts** (`P0-setup.md` split table); each part branches from `main` after the previous one merges.

**Working agreement (user, 2026-11-07):** the agent merges its own PRs once CI is green and asks the user only for decisions, as multiple-choice questions (the user is the decider). It is recorded in CLAUDE.md §4. Decisions so far:
- P0.S2a-1/-2 ADRs accepted; product name stays the placeholder "CodShop" (ADR 0007).
- No Cloudflare staging zone or latency probes for P0.S2a-3.
- **Production hosted in Algeria** (Law 18-07); budget not a constraint now (worst case: one Algerian VPS); provider chosen in P3.S5.
- Platform domain `.com.dz`; everything through Cloudflare.
- Legal questions parked until before production (ADR 0011 §8).
- P0.S2a-3 ADRs (0006, 0011, 0012, 0014, 0015) accepted; **all 16 ADRs are Accepted**.
- ADR 0013 addendum (activeQueues with the stock BullMQ strategy: every worker runs all queues until P1.S6) accepted as written.

## Key results so far (details in `docs/adr/`)
- **ADR 0010:** Option 1, the Vendure React dashboard plus our extensions. Path convention is `plugins/<name>/dashboard/`.
- **ADR 0004/0009:**
  - A COD intake order reaches `Pending` with a quote-exact total (9 100 DZD) through a custom `OrderProcess`, `OrderItemPriceCalculationStrategy`, `ShippingCalculator` and `PromotionAction`.
  - Money is stored with **precision 0**.
  - The order number is a custom field from a per-business counter.
- **ADR 0001:** Node 24 and pnpm 10 work. pnpm needs `onlyBuiltDependencies` and an explicit `typeorm`.
- **ADR 0008:** Vendure session tokens with `tokenMethod: ['cookie','bearer']`. No custom JWT.
- The index and "Decisions that change later briefs" list are in `docs/adr/README.md`.

- **ADR 0002 (spike C):** Channel per Store holds at 5 000 stores (catalog cold p95 46–98 ms, cache +7 MB, `createChannel` < 0.4 s). Vendure's order list fails on a large store (2.6 s cold), so merchant order lists **must** read `cod_order`.
- **ADR 0016 (spike D):** PgBouncer **transaction mode** for api/worker (all 6 checks pass); `migrate` and test-DB setup connect directly; no session `SET` through the pooler.
- **ADR 0013 (spike D):** scheduler exactly-once across 2 workers; `migrate` seeds before replicas start; `TZ=UTC`.
- **ADR 0009 addendum:** on Postgres the per-business order-number counter is gapless under concurrency.

- **ADR 0014 (spike E):** Phase 1 Postgres search (normaliser + `pg_trgm` `word_similarity`, recall@5 0.947) accepted; Vendure's search is unusable for Arabic (0.244).
- **ADR 0006 (spike F):** shared Next cache = the Next repo Redis example with deployment-id-prefixed ISR keys; revalidation reaches the other instance in < 0.11 s.
- **ADR 0011:** hosting in Algeria on self-run VPSs (no managed PG/Redis/K8s exists there); single-VPS compose is the minimum target.

## Blockers and environment notes
- **Machine change (2026-11-07):** P0.S2a-2 ran on an **Arch Linux** machine (native Docker 29, works). The original Windows machine still has Docker disabled. On Linux, check the disk under Docker's root: cold DB numbers on an HDD are ~20× SSD (P0.S2a-2 put the Postgres data on the SSD with a bind mount). The scratch stacks of P0.S2a-2 use ports 5433/6432/6380/3100; P0.S2a-3 must use other ports (for example Postgres 5434, Valkey 6381, Meilisearch 7700, Next 3301/3302, proxy 8181).
- **Docker** on the original Windows machine failed with `HCS_E_HYPERV_NOT_INSTALLED`, because the "Virtual Machine Platform" feature was off. Spikes A/B therefore ran on **SQLite**. Spikes C–F need Docker: Postgres 17, Valkey 8.1, PgBouncer ≥ 1.21 and Meilisearch 1.x. The pinned images are in the shared plan, Task 0.
- **Spike code was never committed**, per the project rule. It stayed on the old machine. Re-create spikes from the code excerpts in ADRs 0004, 0009 and 0010 if you need to re-run them.
- **External access the user may provide:**
  - a Cloudflare staging zone, for spike F items (f) and (g);
  - latency probes, for spike G.
  - Without them, record those items as `pending` and name the session that re-runs them (P3.S5 / before P10.S3).

## What to do next
1. Check PR state: `gh pr list --state all --limit 10`.
2. Branch from an up-to-date `main` (all earlier PRs are merged).
3. Run the next unmerged P0.S2b part from `plans/P0.S2b-plan.md` (Parts 1 = #3, 2 = #79 and 3 = #80 are done; next: **Part 4 "Dashboard RTL", #81**, branch `feat/p0-s2b4-dashboard`). Read the previous part's handoff first (`handoff/P0.S2b-3.md`): the server now boots (`pnpm --filter @cod/server dev`, api on 3100), and its follow-ups include Part 2's `CORS_ORIGINS` note for the Vite dev server.
4. Open items for later sessions, flagged while applying the ADRs:
   - **P3.S5 is now heavy**: an Algerian provider trial (calendar time), hand-built servers (Ansible), a self-run PG/PgBouncer/Valkey/MinIO stack, pgBackRest with restore tests, spike F (f)/(g), plus the original image, pipeline and observability work. Proposal: split it at its start into **P3.S5a** "Provider trial & server baseline" and **P3.S5b** "Image, pipeline, edge & observability", per the mutation protocol.
   - **P4.S2 pagination**: the research-shaped page response (`totalCount`, `totalPages`) conflicts with keyset pagination and `order_counter` (ADR 0016 §4). P4.S2 resolves it: counts from `order_counter`, pages via keyset cursors.
   - **P10.S1/S2 load targets** still use the old capacity figures (infrastructure §3); re-check them once the Algerian provider is benchmarked.
   - **The ADR 0006 cache handler** is adopted in P0.S2b and wired into caching in P3.S2; P3.S2 must not redo the adoption.
5. After P0.S2b-6: P1.S1 (tenancy).

## Kickoff prompt (paste into the new agent)
```
You are continuing the cod-commerce roadmap. Read docs/roadmap/STATUS.md first, then follow CLAUDE.md
for every step. Run session P0.S2a-3 "Search, cache & latency spikes E/F/G" (issue #70, branch
docs/p0-s2a3-search-cache-spikes): copy its tasks (shared plan Tasks 0, 7, 8, 9, 10, 11) from docs/roadmap/plans/P0.S2a-plan.md into
docs/roadmap/plans/P0.S2a-3-plan.md and commit it, then execute (spikes in a scratch folder outside
the repo, Docker required). No Claude attribution in commits or PRs. End with the handoff, push,
gh pr create, and stop without merging.
```
P0.S2a-2's handoff (`handoff/P0.S2a-2.md`) has the machine gotchas (shell aliases, HDD vs SSD, PgBouncer `KILL`/`RESUME`) and the ports already in use.

## Rules that bit us (read once)
- Never push to `main`, never force-push, and use no `--no-verify`. Merging: per the working agreement above (squash-merge once CI is green).
- Commits must contain no AI co-author trailer or "generated with" line. CI `attribution-check` fails the PR otherwise.
- Never write the reference product's names, logo, theme names or copy, except in ADR 0007's banned list.
- Never handle tokens or passwords. The user runs `gh auth login` and provides any credentials.
- Hooks and scripts use LF line endings and keep the exec bit. Run `git config core.hooksPath .githooks` after cloning.
- `scripts/github/bootstrap.sh` creates issues from the README session table and is idempotent. Run `--dry-run` first.
