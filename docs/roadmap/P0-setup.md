# P0 — Setup

**Phase goal:** repo, GitHub, CI, dev environment and the architecture decisions everything else builds on.

**Exit criteria (from README):** Repo builds; CI green on a PR; ADRs merged; `apps/server` + `apps/storefront` + plugin template run locally; all issues/milestones exist.

**Session order:** P0.S1 → P0.S2a-1 → (P0.S2a-2 ∥ P0.S2a-3) → P0.S2b. The only parallel lane is P0.S2a-2 with P0.S2a-3. P0.S1's own PR is the first PR in the repo and doubles as the test of the branch-protection rules. P0.S2a (decisions + throw-away spikes) is reviewed and merged **before** any scaffolding is written, so a wrong base decision costs one small PR, not the whole skeleton.

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

> **Split into six sessions** (user decisions, 2026-11-07): the executable plan `plans/P0.S2b-plan.md` measured ≈ 37 h against an L budget (3–4 h). This section stays the **shared spec** for all six; each part executes the plan tasks for its part (see the plan), writes its own handoff `handoff/P0.S2b-<n>.md` and opens one PR, merged in order.
>
> | Part | Title | Branch | Issue | Prerequisites |
> |---|---|---|---|---|
> | **P0.S2b-1** | Foundation: workspace, quality gates, data services, CI (+ ADR 0011 Garage addendum) | `feat/p0-s2b-scaffolding` | #3 | P0.S2a-1/-2/-3 |
> | **P0.S2b-2** | Server core: env, config, health probes | `feat/p0-s2b2-server-core` | #79 | P0.S2b-1 |
> | **P0.S2b-3** | Server data & image: migrate, seed, e2e, Dockerfile and roles (+ ADR 0013 addendum if confirmed) | `feat/p0-s2b3-server-data-image` | #80 | P0.S2b-2 |
> | **P0.S2b-4** | Dashboard RTL: merchant-shell dashboard host | `feat/p0-s2b4-dashboard` | #81 | P0.S2b-3 |
> | **P0.S2b-5** | Storefront: host-resolved storefront and shared cache handler | `feat/p0-s2b5-storefront` | #82 | P0.S2b-4 |
> | **P0.S2b-6** | Plugin template: reference implementation of the engineering principles | `feat/p0-s2b6-plugin-template` | #83 | P0.S2b-5 |
>
> Object storage is **Garage** instead of MinIO (user decision, 2026-11-07; the official MinIO image is no longer pullable): ADR 0011 addendum. Elsewhere in the docs, "P0.S2b" means all three parts.

| Field | Value |
|---|---|
| **Goal** | A runnable skeleton per the merged ADRs (server, storefront, dashboard extension path, plugin template, shared package, docker compose, CI green) that every later session builds on. |
| **Branch** | `feat/p0-s2b-scaffolding` |
| **GitHub issue** | `P0.S2b Workspace scaffolding` (label `phase-0`, milestone `P0 Setup`) |
| **Prerequisites** | P0.S2a-1, P0.S2a-2 and P0.S2a-3 merged (ADRs accepted by the user). |
| **Parallel-safe** | No. Owns `apps/server`, `apps/storefront`, the dashboard app/extension root chosen in ADR 0010, `plugins/_template`, `packages/shared`, root workspace config, `docker-compose.yml`, root README. |
| **Model / size** | Opus · L |
| **External needs** | Docker (Compose v2) for Postgres 17, PgBouncer, Valkey, MinIO, Mailpit. No credentials. |

**Inventory rows covered:** none directly (foundation).

**Read first**
- docs/roadmap/plans/P0.S2b-plan.md (executable plan for P0.S2b-1/-2/-3)
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P0.S2a-1.md`, `P0.S2a-2.md`, `P0.S2a-3.md`, all of `docs/adr/` (0001 layout, 0002 tenancy, 0004/0009 order totals and lifecycle, 0006 storefront, 0010 dashboard host, 0013 process model are binding), `docs/roadmap/README.md` (parallel-safe rule: shared registration files).
- `docs/architecture/system-design.md` §1.2 (containers), §9 (environments); `docs/architecture/tech-stack.md` (versions per layer).
- ADR 0011 Decision 2 (the compose file is the single-VPS production minimum), ADR 0013 "Runtime environment" and Risks (first boot, `TZ=UTC`, one BullMQ queue), ADR 0016 §6 (pooling), ADR 0006 Decision 4 (cache handler).

**High-level plan**
1. Workspace skeleton per ADR 0001: root workspace config, TS config base, eslint/prettier, test runner, scripts `lint`, `typecheck`, `test`, `build`, `dev` scoped to **our** packages only (never upstream's test suites); `packages/shared` with 58-wilaya constant stub (codes + AR/FR names for a few, full list in P3.S1), order/tracking status constants, domain-event names stub in `packages/shared/src/events/`, `requireFeature('<feature>')` as a documented no-op; pnpm 10 `onlyBuiltDependencies` (bcrypt, better-sqlite3/pg natives, esbuild, sharp, re2) and an explicit `typeorm` dependency (ADR 0001) → commit `feat(shared): workspace, constants stub and requireFeature no-op`.
2. `docker-compose.yml` (Postgres 17, PgBouncer in **transaction mode** (≥ 1.21, `max_prepared_statements` > 0), Valkey (`noeviction`), MinIO for private objects (exports, labels, imports; never R2, ADR 0012), Mailpit) + `.env.example` additions; `apps/server` boots Vendure with separate api / worker / migrate entry points (ADR 0013), BullMQJobQueuePlugin, RedisCachePlugin, DefaultSchedulerPlugin, HardenPlugin, systemOptions.healthChecks: [], a platform-health plugin exposing /livez and /readyz (Postgres, Redis, pending migrations), zero-tax zone + DZD default channel per ADR 0004, against Postgres with one smoke e2e → commit `feat(server): vendure bootstrap on postgres with compose`.
   - **Single-VPS target (ADR 0011):** the same compose file, with only `.env` changed, must run the full stack on one Linux VPS: the role services `migrate`, `api`, `worker`, `storefront` (one image, `ROLE` entry point; a minimal Dockerfile here, hardened in P3.S5) next to the data services, with named volumes, no host-specific bind mounts and no managed-service assumption.
   - **Two database URLs (ADR 0016 §6):** `DATABASE_URL` (through PgBouncer) for `api` and `worker`; `DATABASE_URL_DIRECT` (straight to Postgres) for `migrate` and test-DB setup/teardown. TypeORM `extra.max` per role from env (api 10, worker 5; a worker that runs bulk intake gets a pool sized to its job concurrency).
   - **First boot (ADR 0013):** the `migrate` service runs migrations and then seeds Vendure's defaults (one-shot `bootstrap`), and `api`/`worker` declare `depends_on: migrate: condition: service_completed_successfully` (a concurrent first boot fails on `__default_channel__`). The seed also sets `GlobalSettings.availableLanguages = [ar, fr, en]` (ADR 0002) and the default channel's tax and shipping zones.
   - **`TZ=UTC`** in the environment of every role (ADR 0013).
   - **BullMQ (ADR 0013 Risks):** pin `bullmq` exactly (the version `@vendure/job-queue-plugin` ships with); a test proves that `activeQueues` filters correctly with Vendure's single BullMQ queue (`bull:vendure-job-queue`, job name = Vendure queue name), so the critical/bulk pools of P1.S6 work.
3. Dashboard host per ADR 0010 (Vendure dashboard with our extension root, or `apps/admin`) showing a login page and one empty extension page, Arabic RTL switch proven on that page → commit `feat(dashboard): dashboard host skeleton with rtl`.
4. `apps/storefront` Next.js 16 App Router hello page; proxy.ts (Next 16) resolves store by host and rewrites to /_t/[storeId]/... (`<sub>.localhost`) via a stub resolver, returns 404 page for unknown host; `/livez` and `/readyz` route handlers; the shared cache handler per ADR 0006 Decision 4: the Next repo Redis example adopted as our code under `apps/storefront/cache/`, with ISR/App Shell keys prefixed by the deployment id (`next:{deploymentId}:`) and the `redis` client pinned exactly → commit `feat(storefront): host-resolved hello page`.
5. `plugins/_template`: Vendure plugin (entity with `businessId`, service, GraphQL extension, permission definition), dashboard page at the ADR 0010 path, unit + integration test, README "how to create a plugin" → commit `feat(plugins): plugin template with dashboard page and tests`.
6. Make CI real (replace `--if-present` guards, Postgres service, cache), root README (setup, scripts, ports, `git config core.hooksPath .githooks`) → commit `chore(ci): real lint typecheck test build pipeline`.

**Deliverables**
- Workspace config; `apps/server`; dashboard host; `apps/storefront`; `plugins/_template`; `packages/shared`; `docker-compose.yml`; green CI within the ADR 0001 time budget; root README.

**Acceptance criteria**
- [ ] `docker compose up -d` starts Postgres, PgBouncer, Valkey, MinIO, Mailpit; `<pm> run dev` serves the Vendure admin API and the dashboard host; the dashboard login page loads and the template page renders in AR with `dir="rtl"`.
- [ ] `http://demo.localhost:3000` renders the storefront hello page with the resolved (stub) store name; an unknown host returns the not-found page.
- [ ] `plugins/_template` is registered in `apps/server`, its GraphQL query returns data, its dashboard page renders, its tests pass.
- [ ] `lint`, `typecheck`, `test`, `build` pass locally and in CI on the PR within the ADR 0001 time budget; every @vendure/* dependency is pinned to the same exact version and patches/ is empty (ADR 0001).
- [ ] GET /readyz on api and the worker health port returns 503 when Postgres or Redis is stopped and 200 when both are up.
- [ ] On an empty database, `docker compose up` with the role services runs `migrate` to completion (defaults seeded, `availableLanguages = [ar, fr, en]`, default channel zones set) before `api`/`worker` start; a second `up` is a no-op for `migrate`. The same compose file and `.env.example` contain no localhost-only or managed-service assumption (ADR 0011).
- [ ] `api`/`worker` connect through PgBouncer (`DATABASE_URL`), `migrate` and the test-DB setup through `DATABASE_URL_DIRECT`; every role runs with `TZ=UTC`; `bullmq` is pinned exactly and the `activeQueues` test passes.
- [ ] The storefront cache handler lives under `apps/storefront/cache/` and its ISR keys carry the deployment id (unit test).
- [ ] `packages/shared` exports wilaya list stub, status constants and `requireFeature` (no-op), importable from server, dashboard and storefront.
- [ ] A grep for "Tassyir" in `apps/`, `plugins/`, `packages/shared` returns nothing.

**Verification**
- Unit: shared constants, `requireFeature` no-op, host resolver stub. Integration: server boots against test Postgres and answers a health query; template plugin query.
- Browser check: dashboard login + template page (EN and AR) and storefront hello page per host (no reference screen to compare yet; note it).
- Multi-tenant check: the host resolver test shows two hosts resolving to two different stub stores; the template entity's query filters by `businessId`.

**Out of scope**
- Real Business/Store entities (P1.S1), real host resolver (P1.S1), real auth (P1.S2), full wilaya data (P3.S1), real `requireFeature` (P9.S1), outbox/webhook gateway/queue registry/secrets/flags (P1.S6), the hardened production Dockerfile (multi-stage, non-root, OTel, Trivy), IaC and deploy pipeline (P3.S5).

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
