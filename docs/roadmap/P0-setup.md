# P0 — Setup

**Phase goal:** repo, GitHub, CI, dev environment and the architecture decisions everything else builds on.

**Exit criteria (from README):** Repo builds; CI green on a PR; ADRs merged; `apps/server` + `apps/storefront` + plugin template run locally; all issues/milestones exist.

**Session order:** strictly serial. P0.S1 → P0.S2a → P0.S2b. No parallel lanes. P0.S1's own PR is the first PR in the repo and doubles as the test of the branch-protection rules. P0.S2a (decisions + throw-away spikes) is reviewed and merged **before** any scaffolding is written, so a wrong base decision costs one small PR, not the whole skeleton.

Brief structure: [_session-template.md](_session-template.md). Rules: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## P0.S1 — Repo, GitHub & CI setup

| Field | Value |
|---|---|
| **Goal** | A clean private repository under ChematWalid (no upstream history), with protected `main` (or the documented fallback), CI skeleton incl. an attribution check, PR template, labels, milestones and one issue per roadmap session. |
| **Branch** | `chore/p0-s1-repo-setup` |
| **GitHub issue** | `P0.S1 Repo, GitHub & CI setup` (label `phase-0`, milestone `P0 Setup`) |
| **Prerequisites** | None. |
| **Parallel-safe** | No. Owns `.github/`, `.githooks/`, `.claude/settings.json`, `.gitignore`, `.env.example`, `scripts/github/`, root `README.md`, `docs/` import. |
| **Model / size** | Sonnet · M |
| **External needs** | The user runs `gh auth login` themselves (with the `workflow` scope, see step 1). Claude never handles, prints or stores tokens. No mock needed. |

**Inventory rows covered:** none (infrastructure session; no rows in `docs/feature-inventory.md`).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/plans/P0.S1-plan.md` (executable step-by-step plan; follow it task by task — it supersedes the high-level plan below where they differ).
- `docs/roadmap/CONTRIBUTING.md` (every rule is enforced by this session's setup), `docs/roadmap/README.md` (session table drives issue creation; "GitHub issue title" convention under the table).
- `docs/repo-evaluation.md` "Recommendation: Vendure" (why core must stay untouched, GPLv3 note).
- `docs/architecture/README.md` (executive summary, "Key decisions", open questions 1 and 7) and `docs/adr/drafts/0001-repo-layout-and-upstream.md` (Option C: clean repo on published packages; layout; `pnpm patch` rules).
- Existing local folder `C:\Users\ASUS\Desktop\tasyir-rea\docs` (research, roadmap, architecture and ADR drafts to be copied into the repo).

**GitHub facts this session must handle (do not assume otherwise)**
- ADR 0001 (draft in docs/adr/drafts/) recommends published @vendure/* packages; this session therefore creates an empty repo. If the user rejects that in P0.S2a review, the mirror procedure is restored by a roadmap PR.
- Branch protection / rulesets on **private** repositories require GitHub Pro, Team or Enterprise. On a Free personal account they are unavailable: detect this and use the fallback in step 7.
- Pushing files under `.github/workflows/` needs a token with the `workflow` scope.

**High-level plan**
1. Tooling check: `git --version`, `gh --version`; install `gh` if missing (winget). Ask the user to run `gh auth login --scopes workflow` (or `gh auth refresh -s workflow`), then verify with `gh auth status` (scopes visible, no token output). Set `git config --global user.name "ChematWalid"` (user decision; email `walidchemat@gmail.com`), the user signs `gh` in as ChematWalid, then `gh auth setup-git` so git pushes as ChematWalid; confirm no Claude co-author hook or commit template in global/local git config or `.claude` hooks. Read the account plan with `gh api user --jq .plan.name` and record it → no commit (repo does not exist yet).
2. Create the private repo: `gh repo create ChematWalid/<repo-name> --private --add-readme`; clone it; set the default branch to `main`. Record the latest stable Vendure version (`npm view @vendure/core version`) in the handoff for P0.S2a/P0.S2b → no commit (setup on GitHub only).
3. Branch `chore/p0-s1-repo-setup`. Add root `.gitignore` (node_modules, dist, `.env*` except `.env.example`, `.next`, `.turbo`, uploads, IDE, `*.tfstate*`) and `.env.example` with placeholders only → commit `chore(repo): gitignore and env example`.
4. Copy `docs/` (research, feature-inventory, repo-evaluation, roadmap, architecture, `adr/drafts`, and `screens` — user decision) into the repo → commit `docs(roadmap): import research, architecture and roadmap`.
5. `.github/workflows/ci.yml` skeleton: on pull_request and push to main; jobs install → lint → typecheck → test (Postgres 17 service container, `DATABASE_URL` env) → build; each script step tolerant of "script not defined yet" until P0.S2b (`--if-present`). Add an **attribution-check** job that fails if any commit in the PR or the PR title/body matches `Co-Authored-By:.*(Claude|Anthropic)` or `Generated with .*Claude` (case-insensitive). Add `.github/pull_request_template.md` mirroring CONTRIBUTING (Goal, Closes #N, Inventory rows completed, What changed, How it was verified, Follow-ups, Handoff). Add `.githooks/commit-msg` rejecting the same patterns and `.githooks/pre-push` refusing pushes to `main` (README tells the user to run `git config core.hooksPath .githooks`) and a project `.claude/settings.json` that turns off Claude Code's commit/PR attribution with `"attribution": { "commit": "", "pr": "" }` (`includeCoAuthoredBy` is deprecated and ignored once `attribution` is set) → commit `chore(ci): github actions skeleton, attribution check and pr template`.
6. `scripts/github/bootstrap.sh` (idempotent, uses `gh`): create labels `phase-0..phase-10` + `maintenance` (12) plus `vendure-patch` (ADR 0001 patch rule) and `security` (P10.S2) = 14, milestones `P0 Setup`…`P10 Hardening & launch` named as in README + `Maintenance` (12), and one issue per row of the README session table with title `P{n}.S{m} <Title>`, label, milestone, body = link to the brief in the phase file. Skips anything that already exists (match by exact title). Run it → commit `chore(github): idempotent labels, milestones and issues script`.
7. Push the branch, open the PR. Branch protection on `main` via `gh api` (PR required, required status checks = CI + attribution-check job names, no force-push, no deletion, conversation resolution; admins not exempt if possible). **If the plan is Free** (protection unavailable on private repos): stop and ask the user to choose either upgrading to Pro or the documented fallback (pre-push hook in `.githooks/pre-push` refusing pushes to `main`, CI still mandatory by rule, agent never pushes to `main`); record the choice in the handoff. Verify by attempting `git push origin HEAD:main` (must be rejected by GitHub or by the hook) → commit `docs(roadmap): handoff P0.S1` (end-of-session step). Do not merge; the user reviews.

**Deliverables**
- Clean private repo, origin remote only, recorded Vendure version; `.github/workflows/ci.yml` with attribution-check; `.github/pull_request_template.md`; `.githooks/commit-msg` + `.githooks/pre-push` (always; the primary guard on the Free-plan fallback); root `CLAUDE.md` copied from the archive (session rules auto-loaded by Claude Code); `.claude/settings.json` (attribution off); `.gitignore`/`.env.example`; `scripts/github/bootstrap.sh`; 12 labels (plus `vendure-patch` and `security`), 12 milestones and one issue per README session-table row (64 sessions + the repeatable `M.S1` issue titled `M.S1 Upstream Vendure sync`); branch protection active or the user-approved fallback; root `README.md` stub pointing to `docs/roadmap/README.md`.

**Acceptance criteria**
- [ ] `gh repo view --json isPrivate` shows private; `git remote -v` shows `origin` only; the handoff records the pinned Vendure version.
- [ ] `gh workflow list` shows only our workflows.
- [ ] Either `gh api repos/ChematWalid/<repo>/branches/main/protection` shows required PR, required checks, no force-push — or the handoff records the user's choice of the Free-plan fallback and the pre-push hook is in place.
- [ ] A direct push to `main` is rejected; the session PR cannot merge (or by rule is not merged) until CI is green.
- [ ] CI runs on the PR and passes (stages that have no script yet are skipped, not failing); a throw-away draft PR whose body contains the AI footer makes the attribution-check job fail (then closed and its branch deleted), and the local `commit-msg` hook rejects a message with the AI co-author trailer — no `--no-verify` anywhere.
- [ ] 14 labels and 12 milestones exist; one issue exists for every row of the README session table (count matches); re-running the script creates no duplicates.
- [ ] `git log main..HEAD` shows the user's identity only; no `Co-Authored-By` trailer and no "Generated with" text in any commit or the PR body.
- [ ] `git diff --name-only main...HEAD | xargs grep -nE "ghp_|github_pat_|gho_"` (i.e. only the files this session added) finds no secrets; `.env` is ignored.

**Verification**
- Run the bootstrap script twice and compare issue counts (`gh issue list --limit 300 --json title | jq length`).
- Open the PR and watch the Actions run via `gh pr checks`.
- Browser check: none (no UI). Multi-tenant check: not applicable; note this in the handoff.

**Out of scope**
- Any Node/Vendure scaffolding, lint config, real test setup, `@vendure/*` pins (P0.S2b); architecture decisions (P0.S2a). No upstream clone, mirror or `upstream` remote (ADR 0001). Deploy pipeline (P3.S5). Releases/tags (done per phase later). Dependabot/renovate.

**Kickoff prompt**
```
You are running session P0.S1 "Repo, GitHub & CI setup" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P0-setup.md (section P0.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch chore/p0-s1-repo-setup from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging. Never handle GitHub tokens: ask me to run `gh auth login` myself.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P0.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P0.S2a — Architecture ADRs & spikes

| Field | Value |
|---|---|
| **Goal** | Sixteen ADRs that settle the base decisions (repo layout, tenancy, ids, pricing→order totals, i18n, storefront, branding, auth, order lifecycle, dashboard host, hosting, edge/TLS, process model and queues, search, observability, data lifecycle), each backed where risky by a throw-away spike, merged before any scaffolding. |
| **Branch** | `docs/p0-s2a-adrs` |
| **GitHub issue** | `P0.S2a Architecture ADRs & spikes` (label `phase-0`, milestone `P0 Setup`) |
| **Prerequisites** | P0.S1 merged. |
| **Parallel-safe** | No. Owns `docs/adr/` only. Spike code lives in a scratch folder **outside** the repo and is never committed. |
| **Model / size** | Opus · L |
| **External needs** | Docker Desktop (Postgres, Valkey/Redis, PgBouncer, Meilisearch images for the spikes). Spike F's Cloudflare checks need a staging zone on the user's Cloudflare account and spike G needs probe access (Globalping/RIPE Atlas or volunteer devices); until provided, record those items as "pending" in the ADR and re-run them in P3.S5 (F) or before P10.S3 (G). No other credentials. |

**Inventory rows covered:** none directly (foundation). Decides how rows "Arabic dashboard (RTL, IBM Plex Sans Arabic)" and "Locale switch EN/AR with RTL layout" are built (P1.S5).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P0.S1.md` (recorded Vendure version, plan/protection outcome), `docs/roadmap/README.md` ("Shared contracts", parallel-safe rule).
- docs/architecture/README.md, system-design.md, infrastructure.md and the drafts in docs/adr/drafts/ (start from them: verify, edit with spike evidence, move to docs/adr/NNNN-*.md). Drafts exist for 0001, 0002, 0004, 0006 and 0008–0016; 0003, 0005 and 0007 are written fresh. `docs/architecture/roadmap-impact.md` lists the spike definitions and the roadmap edits already applied.
- `docs/repo-evaluation.md` "Recommendation: Vendure" (extension points: `PaymentMethodHandler`, `FulfillmentHandler`, `ShippingCalculator`, custom `OrderProcess`) and "Builder plan whatever the base".
- `docs/research/data-model.md` headings "Storefront ordering protocol", "Product" (ID shape: 18-digit snowflake strings; `businessId`/`storeId` on every row), "Order (dashboard)", "Billing".
- `docs/research/api-surface.md` "Added in the second pass" → "Auth:" bullet (JWT Bearer + cookies) and "Storefront (public…)" bullet.
- `docs/research/dashboard-captures.md` intro (in the reference product the dashboard and storefront are served by one Next.js app by host — a reference, not a requirement).
- Vendure docs for the pinned version (via context7 or the upstream `docs/` folder): plugins, custom fields, `OrderProcess`, `OrderItemPriceCalculationStrategy`, `ShippingCalculator`, channels/sellers, authentication strategies, the React dashboard extension API.
- Use the `architecture-decision-records` skill for ADR format and the `docs/adr/README.md` index.

**High-level plan**
1. Spike A (scratch folder, e.g. `%TEMP%/vendure-spike`, created with `npx @vendure/create` at the Vendure version recorded in P0.S1): React dashboard extension — can we (a) add an unauthenticated route (register / forgot password), (b) hide or replace the built-in navigation for merchant users, (c) render RTL with an Arabic font, (d) add a business/store switcher in the top bar, (e) is the extension API marked stable in this version? Record each answer with the command/code used → commit `docs(adr): 0010 merchant dashboard host (spike results)`.
   - 0010 decides: **Vendure React dashboard extensions** vs **our own Next.js admin app** (`apps/admin` or the storefront app by host) talking to the Admin API and our plugin APIs, with the Vendure dashboard kept for platform staff. It fixes the path convention that later briefs call `plugins/<name>/dashboard/` (if the decision is a separate app, map it, e.g. `apps/admin/src/features/<name>/`, and say so in the handoff).
2. Spike B (same scratch app): a custom `OrderProcess` with a `Pending`/`Confirmed` state reachable for an order created server-side without the shop checkout; line prices forced from an external quote via `OrderItemPriceCalculationStrategy`; a fixed shipping price via a `ShippingCalculator`; a negative adjustment for an offer discount; zero tax. Record what works → commit `docs(adr): 0004 pricing engine and order totals, 0009 order lifecycle`.
   - 0004: money as integer DZD; our own offer engine vs Vendure Promotions (and why); how a signed quote becomes Vendure order totals (the strategies above); HMAC quote token `qt1.<base64url JSON>.<HMAC>` (fields v, b, s, h, exp, t, sh, l, d, a; ~15 min expiry; key rotation; replay rules) per data-model.md "Storefront ordering protocol" step 3.
   - 0009: COD lifecycle on Vendure: custom states (pending, confirmed, scheduled, canceled, abandoned, dispatched, delivered, returned) and how they compose with or replace the default process (ArrangingPayment, PaymentSettled, Shipped…); COD `PaymentMethodHandler` and when payment is settled (delivery / carrier collection); dispatch as a Vendure Fulfillment or a custom state; merchant custom statuses as **data** (label on a state), never as process states; how intake creates orders (guest Customer per phone or none); where the order number lives (custom field vs `OrderCodeStrategy`).
3. ADRs 0001–0003 → commit `docs(adr): 0001 repo layout and upstream, 0002 tenancy, 0003 ids`.
   - 0001: finalise the draft (options A build inside the upstream monorepo, B mirror repo consuming published packages, C clean repo on published `@vendure/*` exact pins with `pnpm patch` as the reviewed escape hatch — recommended). Confirm: CI time budget, package manager and Node version (verify Node 24 support in the pinned Vendure version), folder layout (`apps/*`, `plugins/*`, `packages/shared`, `packages/config`, `infra/`, `deploy/`, `load/`, `patches/`), the M.S1 procedure (bump pins + migrations + changelog review), patch rules, GPLv3 note incl. the dashboard-bundle question for counsel. The user confirms the choice in the PR review.
   - 0002: tenancy options (separate DB per business, schema per business, shared DB with `businessId` column + guard, Vendure Channels only) with the decision: Business owns 1..n Stores; Store = Channel; Seller per Business; members = Administrators with channel-scoped Roles; every custom entity has `businessId` (+`storeId`); tenant guard + request-context resolver; host→store resolution; how business-wide queries span a business's channels.
   - 0003: Vendure default ids vs snowflake strings in custom entities (one rule, incl. public-API exposure).
4. ADRs 0005–0008 → commit `docs(adr): 0005 i18n, 0006 storefront, 0007 branding, 0008 auth`.
   - 0005: dashboard ar/en with RTL (IBM Plex Sans Arabic), storefront ar/fr/en, translation file layout (consistent with 0010). 0006: Next.js App Router multi-tenant by host, theme JSON rendering, SSR/ISR caching, which API the storefront calls (our REST `/store/*` vs Vendure Shop API). 0007: product-name placeholder and rule "never use Tassyir/Tassya names, logo, theme names (Nocturne, Merino, Linden, Focal, Majestic, Impulse, Studio, Volta) or copy"; all copy keys neutral. 0008: dashboard auth (Vendure's built-in bearer session tokens vs custom JWT — prefer built-in unless a concrete need exists; the reference product's JWT is not a requirement) and auth for public `/store/*` and `/business/:bid/orders/public` (no user auth, store resolved from host/storeId, rate limiting per IP+device, CORS, quote token as price commitment).
4b. Scale and infra spikes (scratch folder, never committed; each recorded in the gated ADR with versions, commands and numbers) → commit `docs(adr): 0011–0016 with spike results`
   - Spike C, channels at scale (ADR 0002): seed 5,000 channels × 50 products × 3 variants (all also in the default channel), 1,000 customers per channel, 5 M orders (Pareto across channels) with SQL generators; measure p95 of channel resolution (cold/warm), product list/detail by channel, order list per channel, admin login with roles on 5 channels, channel-cache memory per API process, create-channel time and locks. Pass: catalog and order list < 150 ms p95 cold at the DB, channel cache < 200 MB, create-channel < 2 s without blocking locks. Record the fallback decision if any fail.
   - Spike D, PgBouncer transaction mode (ADR 0016): run the Vendure e2e smoke, DefaultSchedulerPlugin locking with 2 workers, BullMQ jobs that open DB transactions, RedisCachePlugin sessions, a TypeORM migration, and a SET LOCAL helper through PgBouncer (docker image, transaction mode, version recorded incl. max_prepared_statements); pass/fail per item; decide transaction vs session mode.
   - Spike E, Arabic search (ADR 0014): 300 product names (Arabic with/without diacritics and hamza variants, French, Latin-script Darija) in 3 stores, 60 queries with expected hits; compare DefaultSearchPlugin, the Postgres normalisation + pg_trgm approach, and Meilisearch locally; record recall@5, MRR, p95; accept Phase 1 if recall@5 ≥ 0.85 and within 0.1 of Meilisearch.
   - Spike F, Next.js shared cache handler (ADR 0006): two `next start` instances (Next 16, cacheComponents) behind a local proxy and one Redis; prove cross-instance 'use cache' hits, revalidateTag propagation < 1 s, tenant param in cache keys, rolling restart with a new deploymentId plus assetPrefix serving old chunks, Redis size for 1,000 product pages, Cloudflare stores a tenant page with the TTL from Cloudflare-CDN-Cache-Control (staging zone), two URLs differing only by fbclid share one edge entry on the plan we will buy, /_t/<other store> on a store host returns 404; pick the handler.
   - Spike G, latency (ADR 0011, may finish before P10.S3): RTT from Algerian mobile and fixed networks to DigitalOcean FRA1 and Scaleway fr-par (Globalping/RIPE Atlas probes or volunteer devices); apply the ADR 0011 gate.
5. `docs/adr/README.md` index + a "Decisions that change later briefs" section (start from docs/architecture/roadmap-impact.md) listing every brief assumption the ADRs overturn (e.g. dashboard paths, JWT wording, M.S1 procedure) so the user can open a `docs/roadmap-<change>` PR; keep `docs/adr/drafts/` (the architecture docs link to it) and add a line to its README pointing each draft to its accepted `docs/adr/NNNN-*.md` → commit `docs(adr): index and roadmap impact list`.

**Deliverables**
- `docs/adr/0001…0016-*.md` + `docs/adr/README.md` index with the roadmap-impact list; spike results (versions, commands, outcomes) inside the ADRs. No application code.

**Acceptance criteria**
- [ ] Sixteen ADRs each state context, options considered, decision and consequences; ADR 0002 names the exact entities/fields and the isolation mechanism that P1.S1 must implement.
- [ ] Spikes C–F are recorded with numbers and a pass/fail against the thresholds in this brief; every failed threshold has an explicit fallback decision in its ADR.
- [ ] ADR 0001's recommendation (published packages) is confirmed or rejected by the user in the PR review; if rejected, the PR lists the roadmap edits to restore the mirror procedure.
- [ ] ADR 0010 answers spike questions (a)–(e) with evidence and fixes the dashboard code path convention.
- [ ] ADR 0004/0009 state, with spike evidence, how an intake order gets a COD state and quote-exact totals without editing Vendure core.
- [ ] ADR 0001 states the layout, the CI time budget and the exact M.S1 procedure; the PR asks the user to confirm it.
- [ ] `git diff --stat main...HEAD` touches only `docs/adr/`; no spike code committed.

**Verification**
- Re-run each spike's key command from a clean scratch folder and confirm the recorded outcome (note it in the handoff); for spikes C–F the handoff lists measured numbers next to the thresholds, and any item left "pending" (Cloudflare zone, probes) names the session that re-runs it.
- Browser check: spike A dashboard screenshots (RTL, custom route) attached to the PR.
- Multi-tenant check: ADR 0002 includes the test strategy (two-business suite) P1.S1 must implement.

**Out of scope**
- Any code in the repo (P0.S2b), real entities (P1.S1), real auth (P1.S2).

**Kickoff prompt**
```
You are running session P0.S2a "Architecture ADRs & spikes" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P0-setup.md (section P0.S2a), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch docs/p0-s2a-adrs from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Spikes run in a scratch folder outside the repo and are never committed.
Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P0.S2a.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P0.S2b — Workspace scaffolding

| Field | Value |
|---|---|
| **Goal** | A runnable skeleton per the merged ADRs (server, storefront, dashboard extension path, plugin template, shared package, docker compose, CI green) that every later session builds on. |
| **Branch** | `feat/p0-s2b-scaffolding` |
| **GitHub issue** | `P0.S2b Workspace scaffolding` (label `phase-0`, milestone `P0 Setup`) |
| **Prerequisites** | P0.S2a merged (ADRs accepted by the user). |
| **Parallel-safe** | No. Owns `apps/server`, `apps/storefront`, the dashboard app/extension root chosen in ADR 0010, `plugins/_template`, `packages/shared`, root workspace config, `docker-compose.yml`, root README. |
| **Model / size** | Opus · L |
| **External needs** | Docker Desktop for Postgres, Redis, Mailpit. No credentials. |

**Inventory rows covered:** none directly (foundation).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P0.S2a.md`, all of `docs/adr/` (0001 layout, 0002 tenancy, 0004/0009 order totals and lifecycle, 0006 storefront, 0010 dashboard host, 0013 process model are binding), `docs/roadmap/README.md` (parallel-safe rule: shared registration files).
- `docs/architecture/system-design.md` §1.2 (containers), §9 (environments); `docs/architecture/tech-stack.md` (versions per layer).

**High-level plan**
1. Workspace skeleton per ADR 0001: root workspace config, TS config base, eslint/prettier, test runner, scripts `lint`, `typecheck`, `test`, `build`, `dev` scoped to **our** packages only (never upstream's test suites); `packages/shared` with 58-wilaya constant stub (codes + AR/FR names for a few, full list in P3.S1), order/tracking status constants, domain-event names stub in `packages/shared/src/events/`, `requireFeature('<feature>')` as a documented no-op → commit `feat(shared): workspace, constants stub and requireFeature no-op`.
2. `docker-compose.yml` (Postgres 17, Valkey/Redis, Mailpit) + `.env.example` additions; `apps/server` boots Vendure with separate api / worker / migrate entry points (ADR 0013), BullMQJobQueuePlugin, RedisCachePlugin, DefaultSchedulerPlugin, HardenPlugin, systemOptions.healthChecks: [], a platform-health plugin exposing /livez and /readyz (Postgres, Redis, pending migrations), zero-tax zone + DZD default channel per ADR 0004, against Postgres with one smoke e2e → commit `feat(server): vendure bootstrap on postgres with compose`.
3. Dashboard host per ADR 0010 (Vendure dashboard with our extension root, or `apps/admin`) showing a login page and one empty extension page, Arabic RTL switch proven on that page → commit `feat(dashboard): dashboard host skeleton with rtl`.
4. `apps/storefront` Next.js 16 App Router hello page; proxy.ts (Next 16) resolves store by host and rewrites to /_t/[storeId]/... (`<sub>.localhost`) via a stub resolver, returns 404 page for unknown host; `/livez` and `/readyz` route handlers → commit `feat(storefront): host-resolved hello page`.
5. `plugins/_template`: Vendure plugin (entity with `businessId`, service, GraphQL extension, permission definition), dashboard page at the ADR 0010 path, unit + integration test, README "how to create a plugin" → commit `feat(plugins): plugin template with dashboard page and tests`.
6. Make CI real (replace `--if-present` guards, Postgres service, cache), root README (setup, scripts, ports, `git config core.hooksPath .githooks`) → commit `chore(ci): real lint typecheck test build pipeline`.

**Deliverables**
- Workspace config; `apps/server`; dashboard host; `apps/storefront`; `plugins/_template`; `packages/shared`; `docker-compose.yml`; green CI within the ADR 0001 time budget; root README.

**Acceptance criteria**
- [ ] `docker compose up -d` starts Postgres, Redis, Mailpit; `<pm> run dev` serves the Vendure admin API and the dashboard host; the dashboard login page loads and the template page renders in AR with `dir="rtl"`.
- [ ] `http://demo.localhost:3000` renders the storefront hello page with the resolved (stub) store name; an unknown host returns the not-found page.
- [ ] `plugins/_template` is registered in `apps/server`, its GraphQL query returns data, its dashboard page renders, its tests pass.
- [ ] `lint`, `typecheck`, `test`, `build` pass locally and in CI on the PR within the ADR 0001 time budget; every @vendure/* dependency is pinned to the same exact version and patches/ is empty (ADR 0001).
- [ ] GET /readyz on api and the worker health port returns 503 when Postgres or Redis is stopped and 200 when both are up.
- [ ] `packages/shared` exports wilaya list stub, status constants and `requireFeature` (no-op), importable from server, dashboard and storefront.
- [ ] A grep for "Tassyir" in `apps/`, `plugins/`, `packages/shared` returns nothing.

**Verification**
- Unit: shared constants, `requireFeature` no-op, host resolver stub. Integration: server boots against test Postgres and answers a health query; template plugin query.
- Browser check: dashboard login + template page (EN and AR) and storefront hello page per host (no reference screen to compare yet; note it).
- Multi-tenant check: the host resolver test shows two hosts resolving to two different stub stores; the template entity's query filters by `businessId`.

**Out of scope**
- Real Business/Store entities (P1.S1), real host resolver (P1.S1), real auth (P1.S2), full wilaya data (P3.S1), real `requireFeature` (P9.S1), outbox/webhook gateway/queue registry/secrets/flags (P1.S6), Dockerfile, IaC and deploy pipeline (P3.S5).

**Kickoff prompt**
```
You are running session P0.S2b "Workspace scaffolding" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P0-setup.md (section P0.S2b), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p0-s2b-scaffolding from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P0.S2b.md` → commit → push → `gh pr create` → report PR link → stop.
