# Where we stopped: onboarding for the next agent (2026-11-07, after P0.S2a-2)

Read this first, then `CLAUDE.md` (session rules, mandatory) and `docs/roadmap/CONTRIBUTING.md`.

## Project in one paragraph
This is a multi-store cash-on-delivery commerce SaaS for Algeria, built on **Vendure 3.8.1** (published `@vendure/*` packages, pinned) with a Next.js 16 storefront. Work runs as roadmap sessions: **one session = one branch = one PR**. The user reviews and squash-merges; agents never merge. The roadmap is in `docs/roadmap/README.md`, the briefs in `docs/roadmap/P{n}-*.md`, the plans in `docs/roadmap/plans/` and the handoffs in `docs/roadmap/handoff/`.

## Progress
| Session | Issue | Branch | PR | State |
|---|---|---|---|---|
| P0.S1 Repo, GitHub & CI | #1 | — | #66, #68 | **merged** |
| Roadmap split of P0.S2a into -1/-2/-3 | — | `docs/roadmap-split-p0-s2a` | **#71** (base `main`) | open, waiting for user review/merge |
| **P0.S2a-1** ADRs 0001–0010 & spikes A/B | #2 | `docs/p0-s2a-adrs` | **#72** (stacked, base `docs/roadmap-split-p0-s2a`) | **work done**, open; clean-copy spike re-run not done |
| **P0.S2a-2** Scale spikes C/D (ADRs 0002 evidence, 0013, 0016) | #69 | `docs/p0-s2a2-scale-spikes` | see `gh pr list` (stacked, base `docs/p0-s2a-adrs`) | **work done**, open; handoff `handoff/P0.S2a-2.md` |
| **P0.S2a-3** Search/cache/latency spikes E/F/G (ADRs 0006 evidence, 0011, 0012, 0014, 0015) | #70 | `docs/p0-s2a3-search-cache-spikes` | — | **not started** (needs Docker) |
| **P0.S2b** Workspace scaffolding | #3 | `feat/p0-s2b-scaffolding` | — | not started (needs all P0.S2a parts merged) |

**Merge order:**
1. #71.
2. P0.S2a-1: after #71 is squash-merged, rebase `docs/p0-s2a-adrs` onto `main` and retarget its PR to `main`. Never force-push: rebase locally, then open a fresh branch or ask the user how to proceed, because history rewrites on a pushed branch need the user's OK.
3. P0.S2a-2 and P0.S2a-3, which can run in parallel.
4. P0.S2b.

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
2. If #71 is not merged, ask the user to review and merge it. You may still start a P0.S2a-2/-3 branch stacked on `docs/p0-s2a-adrs`, as P0.S2a-1 did; say so in the PR.
3. Run **P0.S2a-3** (P0.S2a-2 is done). The task text is in `docs/roadmap/plans/P0.S2a-plan.md` (Task 5–6 for -2, Task 7–8 for -3, plus Tasks 0, 9, 10, 11). Ownership is in the split table in `docs/roadmap/P0-setup.md`, section P0.S2a. Copy your part's tasks into `docs/roadmap/plans/P0.S2a-<n>-plan.md` and commit `docs(roadmap): plan P0.S2a-<n>` first.
4. Then P0.S2b per its brief in `docs/roadmap/P0-setup.md`.

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
- Never push to `main`, never force-push, never merge, and use no `--no-verify`.
- Commits must contain no AI co-author trailer or "generated with" line. CI `attribution-check` fails the PR otherwise.
- Never write the reference product's names, logo, theme names or copy, except in ADR 0007's banned list.
- Never handle tokens or passwords. The user runs `gh auth login` and provides any credentials.
- Hooks and scripts use LF line endings and keep the exec bit. Run `git config core.hooksPath .githooks` after cloning.
- `scripts/github/bootstrap.sh` creates issues from the README session table and is idempotent. Run `--dry-run` first.
