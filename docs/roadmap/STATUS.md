# Where we stopped: onboarding for the next agent (2026-11-21, P2 complete, P3 next)

Read this first, then `CLAUDE.md` (session rules, mandatory) and `docs/roadmap/CONTRIBUTING.md`.

## Project in one paragraph
This is a multi-store cash-on-delivery commerce SaaS for Algeria, built on **Vendure 3.8.1** (published `@vendure/*` packages, pinned) with a Next.js 16 storefront. Work runs as roadmap sessions: **one session = one branch = one PR**. Working agreement (user, 2026-11-07): the agent squash-merges its own PR; the user decides via multiple-choice questions. From P2 on (ADR 0018), session PRs target `phase/P{n}` and merge at once; only the phase PR into `main` waits for green CI and browser tests. The roadmap is in `docs/roadmap/README.md`, the briefs in `docs/roadmap/P{n}-*.md`, the plans in `docs/roadmap/plans/` and the handoffs in `docs/roadmap/handoff/`.

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
| **P0.S2b-4** Dashboard RTL: Vendure dashboard at `/dashboard`, `plugins/merchant-shell` (Arabic RTL, IBM Plex Sans Arabic), dashboard build in CI and the image, `browser` workflow | #81 | `feat/p0-s2b4-dashboard` | #89 | **merged** (40ac9ee); handoff `handoff/P0.S2b-4.md`; evidence `docs/evidence/P0.S2b-4/` |
| Security chore: transitive vulnerability overrides, `.gitguardian.yaml` | — | `chore/deps-security-2026-11-08` | #90 | **merged** (19acd5e); overrides re-checked at M.S1 |
| **P0.S2b-5** Storefront: host-resolved hello page (two stub stores), shared Redis cache handler, `storefront` role service, storefront checks in `browser.yml` | #82 | `feat/p0-s2b5-storefront` | #91 | **merged** (6a7d0fe); CI 5m04s; handoff `handoff/P0.S2b-5.md`; evidence `docs/evidence/P0.S2b-5/` |
| **P0.S2b-6** Plugin template: `plugins/_template` reference implementation, `@cod/testing`, stricter lint (`no-unknown-files`, firing fixtures) | #83 | `feat/p0-s2b6-plugin-template` | see `gh pr list` | **merged**; handoff `handoff/P0.S2b-6.md`; evidence `docs/evidence/P0.S2b-6/` |
| **P0.S2c-polish** Pre-P1 polish: CodShop login branding, Arabic strings, RTL password field, storefront stub, mobile sidebar evidence, bearer client proof, ADR 0017 (accepted 2026-11-08), CLAUDE.md §3a.16-19 | #93 | `chore/p0-polish` | see `gh pr list` | **merged**; handoff `handoff/P0.S2c-polish.md`; evidence `docs/evidence/P0.S2c-polish/`; ADR 0017 awaits acceptance |
| **P1.S1** Business→Stores tenancy: `plugins/tenancy`, tenant isolation by construction, host resolver, order sequence | #4 | `feat/p1-s1-tenancy` | see `gh pr list` | **merged**; handoff `handoff/P1.S1.md`; evidence `docs/evidence/P1.S1/`; decisions `P1-decisions.md` |
| **P1.S2** Accounts & auth: `plugins/auth`, `plugins/rate-limit`, sign-up wizard, verification, reset, profile, OAuth behind a flag | #5 | `feat/p1-s2-auth` | see `gh pr list` | **merged**; handoff `handoff/P1.S2.md`; evidence `docs/evidence/P1.S2/`; decisions `P1-decisions.md` |
| **P1.S3** Permissions catalog & roles: 93-permission catalog, `plugins/rbac`, built-in and custom roles, store-scoped access, activity log | #6 | `feat/p1-s3-rbac` | see `gh pr list` | **merged**; handoff `handoff/P1.S3.md`; evidence `docs/evidence/P1.S3/`; decisions `P1-decisions.md` |
| **P1.S5** Admin shell, navigation & Arabic RTL: merchant sidebar and routes, store switcher and Create Store, account menu, general settings, branding, `i18n:check`, light/dark | #8 | `feat/p1-s5-admin-shell` | #99 | **merged**; handoff `handoff/P1.S5.md`; evidence `docs/evidence/P1.S5/`; decisions `P1-decisions.md` |
| **P1.S6** Platform plumbing: queue pools, partitions, outbox with relay, sweeper and reconciler, internal HMAC guard, envelope-encrypted tenant secrets and KEK rotation, webhook gateway, flags and kill switches, partitioned append-only `activity_log` | #9 | `feat/p1-s6-platform-plumbing` | #226 | **merged**; handoff `handoff/P1.S6.md`; evidence `docs/evidence/P1.S6/`; decisions D99-D130 in `P1-decisions.md` |
| **P1.S4** Team members & invitations: `plugins/team`, invite/accept/resend/revoke, members list with tabs, member actions, pay salary placeholder (`salary.paid` on the outbox), commission configs, audit fixes #114, #160, #211, #139 | #7 | `feat/p1-s4-team` | #233 | **merged** (360e1c1); handoff `handoff/P1.S4.md`; evidence `docs/evidence/P1.S4/`; decisions D200-D222 in `P1-decisions.md` |
| P1 audit fixes (`docs/audits/P1-audit.md`, #101) | — | `fix/*` | #102-#105, #213-#215, #218-#220, #224, #228 | **merged**; decisions D400-D405 |
| P1 isolation review: `slugForEntity` cross-business oracle (#229) | — | `fix/slug-for-entity-tenant-leak` | #232 | **merged** (f32bd2a); D500; open-operations gate |
| P1.S4 follow-up: rbac and team audit fixes | — | `fix/s4-audit-rbac` | #234 | **merged** (3a3bf83) |
| P1.S4 follow-up: auth audit fixes | — | `fix/s4-audit-auth` | #237 | **merged** (ce2e282) |
| **P1 closing evidence**: a store owner sees only their own business | — | `test/p1-isolation-evidence` | #235 | **merged**; evidence `docs/evidence/P1-isolation/`; CI test `apps/server/tests/e2e/p1-isolation.e2e.test.ts` |
| **P2.S1** Products & variants: `plugins/catalog` (products, variant matrix, status, brands, tags, highlights, product settings, media library and tenant-prefixed upload, sold-out stop/resume, `CatalogReadService`), product list and editor, store profile logo / address / sold-out settings, audit fixes #108 #122 #124 #125 #170-#172 #174-#178 #199 #210 | #10 | `feat/p2-s1-products` | #243 (contracts #244) | **squash-merged into `phase/P2`** at session end (ADR 0018); handoff `handoff/P2.S1.md`; evidence `docs/evidence/P2.S1/`; decisions D2100-D2170 in `P2-decisions.md`; ADR 0002 §2 addendum accepted 2026-11-21; follow-ups #245-#251 |
| **P2.S4** Pricing & offer engine core: `plugins/offers` (pure engine with quantity, product-discount, order-discount and free-delivery kinds plus discount codes, eligibility, schedule, limits, combination rules; `qt1` HMAC quote token; offer/target/code tables; `PricingService` quote/verify/reprice, `OfferAdminService`, `OfferUsageService`; seams for P2.S2/P2.S3/P3.S1/P3.S4) | #13 | `feat/p2-s4-offer-engine` | #253 | **merged** into `phase/P2` (squash, ADR 0018); handoff `handoff/P2.S4.md`; evidence `docs/evidence/P2.S4/`; decisions D2400-D2451 in `P2-decisions.md`; ADR 0004 amendments accepted 2026-11-21 (D2421, D2445, D2446); follow-up #254 |
| **P2.S3** Collections with conditions: `plugins/collections-rules` (manual and automatic collections in the store channel, rule evaluator with All/Any over tag, brand, price, on sale, title and option values, `collections_definition`/`collections_member` with a per-store lock, event-driven recompute on `product.changed`, store reconcile, paginated preview, `CollectionsReadService`, `CollectionMembershipQueries`), catalog seams (facts reader, membership source registrar, `listVisibleAmong`), offers collection targets (D2341, D2342), dashboard list, editor, condition builder with live preview and product-editor block | #12 | `feat/p2-s3-collections` | #259 (contracts #269) | **squash-merged into `phase/P2`** (ADR 0018); handoff `handoff/P2.S3.md`; evidence `docs/evidence/P2.S3/`; decisions D2300-D2342 in `P2-decisions.md`; ADR 0013 and ADR 0016 amendments accepted 2026-11-21; follow-ups #262-#268 |
| **P2.S2** Packs, import & export: `plugins/catalog-packs` (pack product type with pricing, discount, variant and weight modes, recompute consumer, pack editor block, `expandPackLine`, pack `UnitPriceResolver` registered with the offers) and `plugins/catalog-import` (bulk edit, xlsx/CSV export, spreadsheet import upload → analyze → preview → confirm, link import stub behind an SSRF guard, AI hooks, private Garage object storage, `imports-exports` queue); catalog write facade `CatalogProductCommands`; fixes #260 | #11 | `feat/p2-s2-packs-import` | — (opened at merge) | **merged** into `phase/P2` (squash, ADR 0018); handoff `handoff/P2.S2.md`; evidence `docs/evidence/P2.S2/`; decisions D2200-D2287 in `P2-decisions.md`; follow-ups #261, #270 |
| **P2.S5** Offer kinds BXGY/add-on & offers admin: `plugins/offers` buy-X-get-Y (gift lines) and add-on kinds (add-ons in quotes and tokens), target roles per kind, post-order add-on service and `offer.applied` event, publish validation, duplicate, code generation, paged lists, stats, app types and preview; offers Admin API (GraphQL + REST); dashboard offers list, 7-card create dialog, per-kind editors with shared sections, live summary and Arabic order-form preview, codes panel, product editor Offers block | #14 | `feat/p2-s5-offers-admin` | #256 | **merged** into `phase/P2` (squash, ADR 0018); handoff `handoff/P2.S5.md`; evidence `docs/evidence/P2.S5/`; decisions D2500-D2544 in `P2-decisions.md`; ADR 0004 amendment (P2.S5) accepted 2026-11-21; follow-up #273 |
| P2 phase end: #261 items 1 and 3 (bulk results by title, import preview on a phone, D2000), style-gate fix-forward | #261 | `fix/p2-catalog-import-261`, `fix/p2-style-gate-comment` | #275, #276 | **merged** into `phase/P2`; P2.S2 evidence regenerated |
| **P2 phase → `main`** | — | `phase/P2` | #277 | **merged** (squash cbdb3114, 2026-11-21) after 52/52 checks green incl. browser; `phase/P2` kept, tag `phase-P2-final` at 2b8d703c. **P2 complete.** |
| **P3.S1** Wilaya/commune data & delivery pricing (part 1): `plugins/geo` (69 wilayas after law 26-06, 1,541 communes with ONS codes, public `/provinces*`, signed per-store `/store/provinces/code/:code`), `plugins/delivery-pricing` (per-store pricing options with wilaya rows and a sparse commune layer, indicative default table named in the store language, `ShippingQuoteService` with `source`, offers shipping seam, carrier sync hook), #230/#153 store reference checks, Delivery pricing tab and store-settings field, P3 delivery-pricing isolation rows | #15 | `feat/p3-s1-geo-delivery-pricing` | #305 | **merged** into `phase/P3` (squash, ADR 0018); handoff `handoff/P3.S1.md`; evidence `docs/evidence/P3.S1/`; decisions D3100-D3139 in `P3-decisions.md`; part 2 (bulk tools, copy, CSV, D3126) next in the same session; follow-ups #283, #292-#294, #302, #304 |
| **P3.S2** Storefront skeleton: `plugins/storefront-api` (per-store `storefront_product` projection, public catalog, collection and Arabic-aware search endpoints with per-business Darija synonyms, outbox-driven revalidation with a coalesced CDN purge port), tenancy storefront store context and `store.changed`, storefront app (host binding `/_t/{locale}/{storeId}/{binding}`, ar/fr/en with RTL, pluggable theme renderer, catalog pages, cart/checkout shells, SEO, image loader, same-origin `/api/store`), cache hardening (#120 #121 #180 #183 #184), id lint (#127), catalog public read fixes (#246 #266), demo seed, P3 isolation e2e and smoke on pull requests (#182); #251 storefront part | #16 | `feat/p3-s2-storefront-skeleton` | PR into `phase/P3` (see handoff) | **merged** into `phase/P3` (squash, ADR 0018); handoff `handoff/P3.S2.md`; evidence `docs/evidence/P3.S2/`; decisions D3200-D3226 in `P3-decisions.md`; ADR 0006 addendum to accept; follow-ups #284-#291, #295-#297; first CI runs of the new jobs due before the phase PR |

**Merge order:** P0.S2a (#71–#77) and the P0.S2b split (#84) are merged. **P0.S2b runs as six sequential parts** (`P0-setup.md` split table); each part branches from `main` after the previous one merges.

**Working agreement (user, 2026-11-07):** the agent merges its own PRs and asks the user only for decisions, as multiple-choice questions (the user is the decider). It is recorded in CLAUDE.md §4. **From P2 on (user, 2026-11-13, ADR 0018):** session PRs target `phase/P{n}` and merge at once while CI runs in the background; only the phase-end PR into `main` waits for green CI and browser tests. Decisions so far:
- P0.S2a-1/-2 ADRs accepted; product name stays the placeholder "CodShop" (ADR 0007).
- No Cloudflare staging zone or latency probes for P0.S2a-3.
- **Production hosted in Algeria** (Law 18-07); budget not a constraint now (worst case: one Algerian VPS); provider chosen in P3.S5b.
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
  - Without them, record those items as `pending` and name the session that re-runs them (P3.S5b / before P10.S3).

## What to do next
1. Check PR state: `gh pr list --state all --limit 10`.
2. Branch from an up-to-date `main` (all earlier PRs are merged).
3. **P2 is complete** (2026-11-21): P2.S1-S5 are on `main` via the phase PR #277. Next is **P3**: create `phase/P3` from `main` (ADR 0018) and follow its brief. Read the P2 handoffs and `P2-decisions.md` first. Awaiting the user's acceptance: the ADR 0002 §2 addendum (D2117), the ADR 0004 amendments (P2.S4 D2421/D2445/D2446, P2.S5), and the ADR 0013 and 0016 amendments (P2.S3). Open `after-P2` follow-ups: #245-#251, #254, #261 (items 2, 4, 5), #262, #264-#267, #270, #273; from P1: #230 (P3.S1), #231 (P10.S2).
4. Open items for later sessions, flagged while applying the ADRs:
   - **P3.S5 is now heavy**: an Algerian provider trial (calendar time), hand-built servers (Ansible), a self-run PG/PgBouncer/Valkey/MinIO stack, pgBackRest with restore tests, spike F (f)/(g), plus the original image, pipeline and observability work. Split on 2026-11-23 into P3.S5a (no accounts) and P3.S5b (accounts, go-live); see the P3 brief and D3500.
   - **P4.S2 pagination**: the research-shaped page response (`totalCount`, `totalPages`) conflicts with keyset pagination and `order_counter` (ADR 0016 §4). P4.S2 resolves it: counts from `order_counter`, pages via keyset cursors.
   - **P10.S1/S2 load targets** still use the old capacity figures (infrastructure §3); re-check them once the Algerian provider is benchmarked.
   - **The ADR 0006 cache handler** is adopted in P0.S2b and wired into caching in P3.S2; P3.S2 must not redo the adoption.

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
- Never push to `main`, never force-push, and use no `--no-verify`. Merging: per the working agreement above (P1: squash-merge once CI is green; from P2: squash-merge into `phase/P{n}` at once, phase PR into `main` only when fully green, ADR 0018).
- Commits must contain no AI co-author trailer or "generated with" line. CI `attribution-check` fails the PR otherwise.
- Never write the reference product's names, logo, theme names or copy, except in ADR 0007's banned list.
- Never handle tokens or passwords. The user runs `gh auth login` and provides any credentials.
- Hooks and scripts use LF line endings and keep the exec bit. Run `git config core.hooksPath .githooks` after cloning.
- `scripts/github/bootstrap.sh` creates issues from the README session table and is idempotent. Run `--dry-run` first.
