# P10 — Hardening & launch

**Phase goal:** prove the whole product works end to end, close security and performance gaps, and put it in production.

**Exit criteria (from README):** E2E COD loop green in CI; tenant-isolation and authz tests pass; production deploy with wildcard subdomains + TLS.

**Session order:** strictly serial: P10.S1 → P10.S2 → P10.S3. No parallel lanes (each session changes cross-cutting files). After P10.S3, tag `v0.10.0` and publish the release per CONTRIBUTING.md. `M.S1` (appendix) is independent and repeatable at any time after P0.S2b, but should not run while a P10 session is open. P10.S1 starts only when **every P1–P9 session is merged** (sessions still waiting for credentials are merged against their mocks).

**Note on inventory rows:** P10 sessions complete no feature-inventory rows; they verify them. The "Inventory rows covered" list says which rows each session exercises. Do not tick rows in P10 unless a row was found unfinished and fixed.

---

## P10.S1 — End-to-end test suite

| Field | Value |
|---|---|
| **Goal** | A Playwright E2E suite that runs the full COD loop and key guarantees in CI with docker services. |
| **Branch** | `test/p10-s1-e2e` |
| **GitHub issue** | `P10.S1 End-to-end test suite` (label `phase-10`, milestone `P10 Hardening & launch`) |
| **Prerequisites** | Every P1–P9 session merged (README lists the leaves; the specs below need at least P4.S5 spam release, P5.S3 returns, P6.S4 profit, P7.S2 home, P8.S6 themes, P8.S7 landing pages, P9.S1 quotas and the P9.S2 fake payment provider). |
| **Parallel-safe** | No. Owns `e2e/**`, `.github/workflows/e2e.yml`, `docker-compose.e2e.yml`; may add `data-testid` attributes in app code (no behaviour change). |
| **Model / size** | Sonnet · L |
| **External needs** | None; all carriers/providers run on mocks and the fake payment provider. |

**Inventory rows covered** (exercised, not newly built)
- 7-day trial without card; Over-quota and expired-trial behaviour: orders accepted, buyer phone hidden until upgrade/renew
- COD order form on product page: full name, phone, wilaya → commune, delivery type, live delivery fee and total (cart quote)
- Spam hold release; Confirm → Dispatch → Deliver; Carrier cash collection; Profit report
- Returns list & processing; Visual builder publish; Landing pages
- Locale switch EN/AR with RTL layout

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; all handoff notes from P3–P9 (seed data, test helpers, mock carrier servers).
- `docs/research/second-pass.md` → "Storefront order → delivered (full lifecycle, test order #00000001)", "Other order actions", "Cash collection and finance (performed)".
- `docs/research/data-model.md` → "Storefront ordering protocol", "Spam hold", "Billing" (quota/masking).
- `docs/research/dashboard-captures.md` → "Orders", "Tracking", "Returns", "Finance".

**High-level plan**
1. Playwright project, docker-compose E2E stack (server, worker, storefront, Postgres, Redis, mock carrier, Mailpit), deterministic seed + per-test business factory via API → commit `test(e2e): playwright harness and stack`
2. Core COD loop: signup → create store → product → offer → storefront order on `<sub>.localhost` → spam release → confirm → dispatch (Private Courier, then one mocked carrier) → deliver → record collection → profit report matches hand-computed numbers → commit `test(e2e): full cod loop`
3. Returns (return → process with restock/damaged → stock and wallet effects) and builder edit → publish → storefront shows change; landing page order → commit `test(e2e): returns and builder publish`
4. Plan quota masking: exhaust quota → order accepted and masked → fake-provider upgrade → unmasked; Arabic RTL smoke (`dir="rtl"`, key screens render, no overflow) → commit `test(e2e): quota masking and rtl smoke`
5. Multi-tenant isolation across two businesses (UI and API: ids, URLs, search, exports, storefront host) → commit `test(e2e): tenant isolation`
6. CI workflow with docker services, traces/videos on failure, sharding; flaky-test policy doc (no `waitForTimeout`, quarantine tag with issue link, max 1 retry, fix-or-remove in 7 days) → commit `ci(e2e): workflow and flaky policy`

**Deliverables:** `e2e/` specs and page objects, factories, `docker-compose.e2e.yml`, `.github/workflows/e2e.yml`, `docs/testing/e2e.md`.

**Acceptance criteria**
- [ ] COD loop spec passes locally and in CI with no retries; profit figures asserted against a fixture computed by hand in the spec comments.
- [ ] Returns, builder publish, quota masking/unmask, RTL smoke each have at least one passing spec.
- [ ] Isolation spec: business B user/API key requesting any of A's order, product, customer, store or export ids gets 404/403 and sees none of A's rows in lists or search.
- [ ] Suite runs in under 15 minutes in CI; failing runs upload trace + video artifacts.
- [ ] 10 consecutive CI runs on `main` produce no flake (record in handoff).

**Verification**
- Run the suite 3 times locally and 3 times in CI; confirm failure artifacts by deliberately breaking one assertion on a scratch branch.
- Browser check is the suite itself; compare flows to `second-pass.md` lifecycle.
- Multi-tenant check is a first-class spec above.

**Out of scope:** fixing product bugs beyond test-id additions (file issues or fix in P10.S2); load testing (P10.S2).

**Kickoff prompt**
```
You are running session P10.S1 "End-to-end test suite" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P10-hardening.md (section P10.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch test/p10-s1-e2e from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with:** tick inventory rows → write `docs/roadmap/handoff/P10.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P10.S2 — Security & performance hardening

| Field | Value |
|---|---|
| **Goal** | Audit and fix tenant isolation, authorization, public-endpoint abuse, secrets/PII handling and performance hot spots. |
| **Branch** | `fix/p10-s2-hardening` |
| **GitHub issue** | `P10.S2 Security & performance hardening` (label `phase-10`, milestone `P10 Hardening & launch`) |
| **Prerequisites** | P10.S1 merged. |
| **Parallel-safe** | No. Touches many plugins for fixes; owns `docs/security/**`, `docs/performance/**`, `load/**`. |
| **Model / size** | Opus · L |
| **External needs** | The P3.S5 staging environment: k6 runs through Cloudflare against staging (infrastructure.md §3); if a target needs Growth-size capacity, the user approves scaling staging for the test window, and the size used is recorded with the results. |

**Inventory rows covered** (audited): Roles: 7 built-in templates; custom roles with 94 permissions; Over-quota masking; Anti-bot signals on submit; Spam engine; Public Admin API; every other row's data access path.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; `handoff/P10.S1.md`, P1.S1, P1.S3, P1.S6, P3.S4, P3.S5, P4.S5, P9.S7a, P9.S8a, P9.S8b handoffs; `docs/adr/` tenancy (0002, RLS spike), auth (0008) and permission ADRs.
- `docs/architecture/infrastructure.md` §3 (capacity math, load targets); `docs/architecture/system-design.md` §4 (per-tenant limits), §7 (security), `docs/architecture/README.md` "Review log" (findings to re-verify).
- `docs/research/data-model.md` → "Storefront ordering protocol" (public endpoints: quotes, abandoned checkout, order intake, visitors/beacon), "Spam hold", "Billing".
- `docs/research/api-surface.md` (every endpoint family is a surface to audit), `dashboard-captures.md` → "Team" (permissions).

**High-level plan**
1. Tenant isolation audit: enumerate every entity, resolver, REST route, job, webhook and file/CDN path; generate a checklist in `docs/security/tenant-audit.md`; add an automated test that fails if an entity lacks `businessId` or a resolver lacks the guard; fix gaps; run the RLS spike from ADR 0002 on cod_order, tenant_secret, customer_profile, activity_log (SET LOCAL app.business_id in the repository helper) and record overhead; adopt if < 5 % p95 → commit `fix(tenancy): close isolation gaps from audit`
2. Authorization audit against the 94 permissions: matrix test per permission area (None/View/Full) over every mutation/query, including exports, bulk actions, AI tools and API keys; sensitive-flag permissions → commit `fix(rbac): enforce permission matrix`
3. Public endpoint abuse: rate limits and body-size caps on order intake, quotes, abandoned checkout, visitors/beacon, login/reset/OTP, webhooks; quote-token tamper/replay tests; input validation (zod/class-validator) and output encoding → commit `fix(security): rate limits and validation on public endpoints`
4. Secrets/PII: encryption-at-rest check for all provider tokens, log redaction (phones, tokens), masked phone never in exports/logs/webhook payloads, CSP and security headers on storefront and dashboard, cookie flags, CSRF, SSRF guard for product-link scraping and webhooks → commit `fix(security): secrets, pii and headers`
5. Dependency and OWASP pass: `npm audit`/OSV, secret scanning, OWASP Top 10 checklist with results; findings fixed or filed as issues labelled `security` → commit `chore(security): dependency audit and owasp checklist`
6. Performance: index review from `EXPLAIN` and `pg_stat_statements` (enabled on every environment, ADR 0015) on orders list, tracking, analytics and finance queries; confirm every probe and uptime check uses `/readyz`/`/livez`, never Vendure's `/health` (it does not check dependencies), and queue dashboards/alerts group by job name (one BullMQ queue, ADR 0015); fix N+1 (dataloaders); cache/pre-aggregate heavy analytics; storefront ISR/caching of products and themes with revalidation on publish → commit `perf(db): indexes, n+1 fixes and analytics caching`
7. Load test the storefront order path (k6: product page → cart-quote → order submit) against targets from docs/architecture/infrastructure.md §3 for the Growth tier spike: 140 rps quotes (p95 < 250 ms), 18 rps intake (p95 < 600 ms), 63 rps storefront origin HTML, 113 rps dashboard list queries (p95 < 500 ms) on a 5 M-order seed; storefront traffic generated through Cloudflare with a unique fbclid per virtual user (edge hit ratio ≥ 85 %), and intake traffic from a small set of IPs to prove CGNAT-shared buyers are held, not rejected; before/after numbers in `docs/performance/` → commit `test(perf): storefront order path load test`

**Deliverables:** fixes across plugins, `docs/security/*`, `docs/performance/*`, `load/` scripts, new automated guard tests wired into CI, filed issues for anything not fixed.

**Acceptance criteria**
- [ ] Automated test fails when a new entity is added without `businessId` or a resolver without the tenant guard (prove by temporarily adding one).
- [ ] Permission matrix test passes for all 94 permissions; a role with "View" cannot call a "Full" mutation.
- [ ] Order intake turns bursts above the configured per-(store, device) and per-store rates into holds (never a 429 or a dropped order), only abuse-level per-IP limits return 429 at the edge; tampered or expired quote tokens are rejected (400/409).
- [ ] The RLS spike result (overhead per table, adopt or not) is recorded in an ADR 0002 addendum.
- [ ] No raw phone, token or secret appears in logs, error responses, exports (masked orders) or webhook logs (grep test on captured logs).
- [ ] Dependency audit has no unresolved high/critical findings; remaining are listed with an issue.
- [ ] On a 5 M-order seed the stack sustains the Growth-spike targets from infrastructure.md §3: 140 rps quotes with p95 < 250 ms, 18 rps intake with p95 < 600 ms, 63 rps storefront origin HTML, 113 rps dashboard list queries with p95 < 500 ms; storefront edge hit ratio ≥ 85 % with a unique `fbclid` per virtual user; intake from a few shared IPs produces holds, not rejections.
- [ ] Every finding is either fixed or has a GitHub issue linked in the handoff.

**Verification**
- Full unit/integration suite plus the P10.S1 E2E suite green after fixes.
- Browser: spot-check masked-phone orders, role-restricted member views and RTL after header/CSP changes (no broken scripts/styles; pixel and builder iframe still work with CSP).
- Multi-tenant: re-run the isolation spec; the new schema-level audit test is the standing guard.

**Out of scope:** infrastructure and deployment hardening (P10.S3); new features.

**Kickoff prompt**
```
You are running session P10.S2 "Security & performance hardening" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P10-hardening.md (section P10.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch fix/p10-s2-hardening from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with:** tick inventory rows → write `docs/roadmap/handoff/P10.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P10.S3 — Production deployment

| Field | Value |
|---|---|
| **Goal** | Deploy production in Algeria (ADR 0011) from the P3.S5 pipeline, runbook and modules (servers by runbook/Ansible, OpenTofu env prod for Cloudflare/DNS, Kamal deploy/prod.yml) with Cloudflare for SaaS custom domains, backups and a restore drill, monitoring, and a gated release workflow. |
| **Branch** | `chore/p10-s3-deploy` |
| **GitHub issue** | `P10.S3 Production deployment` (label `phase-10`, milestone `P10 Hardening & launch`) |
| **Prerequisites** | P10.S2 merged (P3.S5 staging and P8.S9 domains are merged transitively). **Spike G** (RTT from Algerian mobile and fixed networks to the chosen provider, ADR 0011) recorded before this session starts. The **pre-production legal checklist** (step 7) is answered before production takes real buyer data. |
| **Parallel-safe** | No. Owns `infra/envs/prod/**`, `deploy/prod.yml`, `.github/workflows/deploy-prod.yml`, production sections of `docs/ops/**`; may extend (not fork) the P3.S5 modules in `infra/modules/**`. |
| **Model / size** | Opus · M |
| **External needs** | 🔑 production VPS(s) at the Algerian provider chosen in P3.S5 and backup storage at the second Algerian provider (ADR 0011), the `.com.dz` platform domain on Cloudflare, Cloudflare for SaaS enabled, GitHub environment secrets; the user's answers to the legal checklist (step 7). The session builds everything reproducibly and stops at a clear "needs you" checklist for what only the user can provision. |

**Inventory rows covered** (exercised): Free subdomain; Custom domains (Custom domain connect → DNS → verify) on real infrastructure.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; `handoff/P10.S2.md`, P3.S5 (pipeline, modules, runbook), P8.S9 (domains, Cloudflare client), P0.S2b (compose, env conventions); `docs/adr/` 0011 (hosting in Algeria, spike G, open legal questions), 0012, 0013, 0015, 0016.
- `docs/architecture/infrastructure.md` §1.1 (Launch topology), §2, §6 (migration path; §5 costs are superseded); `docs/architecture/system-design.md` §5 (backups), §9 (environments and delivery), §10 (reliability).
- `docs/research/dashboard-captures.md` → "Store settings" (Domains: subdomain Change, Connect domain); `api-surface.md` → "Catalog & store" (`/domains`, `/verify`).

**High-level plan**
1. Production servers from the P3.S5 runbook/Ansible on the chosen Algerian provider (no managed services, no provider API, no Kubernetes; ADR 0011): at minimum one VPS running the full compose stack (Postgres 17 with `pg_stat_statements`, PgBouncer transaction mode, Valkey noeviction, MinIO for private objects), sized from the P3.S5 trial; `infra/envs/prod` (OpenTofu) covers Cloudflare/DNS and R2 for public assets only → commit `chore(infra): production environment`
2. Cloudflare: wildcard *.<root>, app/api/cdn hosts, fallback origin and stores.<root> CNAME target for custom hostnames (ADR 0012), WAF/rate-limit rules → commit `feat(deploy): production edge and custom hostnames`
3. Migrations on deploy: reuse the P3.S5 `migrate` pre-deploy hook for production (backward-compatible expand/contract, rollback note; the M.S1 old-image check or maintenance window with the intake spool for core migrations), seed of plans only → commit `chore(deploy): migrations on deploy`
4. Backups and restore drill: pgBackRest with WAL archiving (PITR) plus a nightly encrypted `pg_dump`, both to the **second Algerian provider** (14 daily + 3 monthly, object lock where available; never R2), MinIO objects replicated there too, the monthly automated restore test scheduled, erasure ledger replayed after restore, documented and executed restore into staging; the PG standby (manual, rehearsed promotion) is a Growth step unless the user asks for it now → commit `docs(ops): backups and restore drill`
5. Observability for production: extend the P3.S5 baseline (separate Grafana/Sentry environments, page/notify alert levels per ADR 0015, business alerts such as intake silence and `intake_spool_length`, external uptime checks) → commit `chore(ops): production monitoring and alerting`
6. GitHub Actions deploy workflow: production via workflow_dispatch restricted to maintainers and a production environment limited to main (required reviewers on private repos need GitHub Enterprise [verify]); Kamal lock; post-deploy smoke and warm-up; rollback command; release tag `v0.10.0` + GitHub release notes → commit `ci(deploy): gated deploy workflow and release`
7. Pre-production legal checklist in `docs/ops/legal-checklist.md` (ADR 0011 Decision 8; parked by the user until now, not legal advice): (a) ANPDP declaration/authorisation for our processing under Law 18-07 Arts. 12 and 44, including whether Cloudflare edge TLS termination and EU processors (Sentry, Grafana Cloud, email/SMS, AI APIs) count as transfers; (b) whether the SaaS needs its own ARPCE cloud authorisation and an Algerian legal entity; (c) how Law 18-05 Art. 8 (`.com.dz`, hosted in Algeria) applies to multi-tenant storefronts and merchants' custom domains. Each item records the user's answer or an explicit decision to launch without it → commit `docs(ops): pre-production legal checklist`

**Deliverables:** `infra/envs/prod`, `deploy/prod.yml`, production Cloudflare config, `deploy-prod.yml` workflow, production sections of `docs/ops/runbook.md` (deploy, rollback, restore, on-call alerts), a "you must provision" checklist, release tag.

**Acceptance criteria**
- [ ] Production is reachable; a store at `<sub>.<root-domain>` serves over valid TLS through Cloudflare, and an order placed there appears in the dashboard.
- [ ] A custom domain verified in the dashboard is active at Cloudflare and served over HTTPS; an unverified domain is never created at Cloudflare and returns 404 by host.
- [ ] Production deploy can only be started by a maintainer from `main` (or requires a reviewer where the plan supports it; the handoff records which); a failed smoke test blocks promotion and the rollback command restores the previous image.
- [ ] pgBackRest PITR and the nightly dump land at the second Algerian provider (nothing in R2 but public assets), and a PITR restore into staging passes the E2E smoke (evidence).
- [ ] Spike G results are recorded in ADR 0011, and the legal checklist (step 7) has an answer or an explicit user decision for every item before production takes real orders.
- [ ] Restore drill executed: a backup restored to staging and the E2E smoke passes against it (evidence in handoff).
- [ ] Alerts fire in a staged failure test (stop the worker; queue-stuck alert triggers).
- [ ] No secrets in repo, images or logs (secret-scan job green).

**Verification**
- Run the P10.S1 E2E smoke subset against production (synthetic test store) after deploy.
- Browser: dashboard login, storefront on wildcard subdomain, custom-domain flow vs `dashboard-captures.md` "Store settings → Domains".
- Multi-tenant: in production, two businesses' subdomains and custom domains never serve each other's catalog; host-header spoof test returns the default/404 page.

**Out of scope:** new features; scaling beyond the initial Algerian setup (Growth: PG standby, Valkey VM; Scale: more VMs with Kamal; no Kubernetes); multi-provider failover beyond the second-provider backups.

**Kickoff prompt**
```
You are running session P10.S3 "Production deployment" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P10-hardening.md (section P10.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch chore/p10-s3-deploy from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with:** tick inventory rows → write `docs/roadmap/handoff/P10.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## Appendix — M.S1 — Upstream Vendure sync (repeatable)

| Field | Value |
|---|---|
| **Goal** | Bring a new upstream Vendure release into our repo by bumping all @vendure/* pins to the new exact version (ADR 0001 procedure), adapt our plugins, and record any breaking changes. |
| **Branch** | `chore/upstream-sync-<version>` (e.g. `chore/upstream-sync-3.9.0`) |
| **GitHub issue** | `M.S1 Upstream Vendure sync` (repeatable; one comment per run with the version; label `maintenance`, milestone `Maintenance`) |
| **Prerequisites** | P0.S2b merged (the staging deploy and old-image check in step 4 apply once P3.S5 is merged); run whenever Vendure releases a minor; not while another session has an open PR touching `package.json`/lockfiles. |
| **Parallel-safe** | No (changes root dependencies and lockfile). Owns the version bump, `patches/` and the core migration only; no feature code. |
| **Model / size** | Sonnet · S |
| **External needs** | None. |

**Inventory rows covered:** none.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md` (Repository: published `@vendure/*` exact pins, no `upstream` remote, core never edited, `pnpm patch` rule); ADR 0001 §5 and §7 (patch rules, M.S1 procedure) in `docs/adr/`; ADR 0016 §5 (expand/contract migrations and the core-migration exception); previous `docs/adr/*upstream-sync*` addenda; open `vendure-patch` issues; the target version's release notes and migration guide.
- `docs/architecture/system-design.md` §9 (staging old-image check before production, maintenance window with the intake spool).

**High-level plan**
1. From up-to-date `main`: `npm view @vendure/core versions`, create the chore branch, record current and target versions, read the upstream changelog and migration guide for breaking changes → commit `docs(adr): upstream sync <version> plan`
2. Bump every @vendure/* dependency to the same exact version in one commit, pnpm install, re-apply or drop each patches/ entry (each needs re-validation), npx vendure migrate --generate vendure-<version> and review the core migration → commit `chore(upstream): vendure <version>`
3. Update our plugins/apps for API changes (typings, deprecated APIs, DB migrations generated for our entities, dashboard extension API changes, OTel attribute names used by the telemetry plugin); never edit `node_modules`; a new core fix goes through a reviewed `pnpm patch` only (ADR 0001) → commit `fix(deps): adapt plugins to vendure <version>`
4. Run lint, typecheck, unit/integration tests and the full Playwright E2E suite; deploy to staging and run the old-image check (old image against the migrated schema); fix regressions → commit `test(upstream): green suite on <version>`
5. Add an ADR addendum (`docs/adr/`) listing breaking changes, required migrations and any workarounds; then push and `gh pr create` → commit `docs(adr): upstream sync <version> addendum`

**Deliverables**
- The pin-bump commit, adapted plugins/apps, the reviewed core migration and regenerated migrations for our entities if needed, re-validated or removed `patches/` entries, ADR addendum `docs/adr/NNNN-upstream-sync-<version>.md`, handoff note.

**Acceptance criteria**
- [ ] All @vendure/* pins equal <version>; patches/ entries are re-validated or removed with their issues closed; OTel attribute names re-checked (telemetry plugin).
- [ ] The core migration is reviewed in the PR; the staging old-image check passed, or the PR states that production needs a maintenance window with the intake spool on.
- [ ] CI is green including E2E; DB migrations run forward on a copy of staging data.
- [ ] ADR addendum merged in the same PR.

**Verification:** full test and E2E run; dashboard and storefront smoke in the browser; multi-tenant isolation spec from P10.S1 passes.

**Out of scope:** feature work; upgrading unrelated dependencies; cherry-picking partial upstream changes; any upstream source mirror or `upstream` remote.

**Kickoff prompt**
```
You are running session M.S1 "Upstream Vendure sync" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P10-hardening.md (section M.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch chore/upstream-sync-<version> from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with:** tick inventory rows (none) → write `docs/roadmap/handoff/M.S1-<version>.md` → commit → push → `gh pr create` → report PR link → stop.
