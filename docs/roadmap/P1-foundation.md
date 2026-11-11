# P1 — Foundation

**Phase goal:** multi-tenant Business→Stores, accounts, permissions, team, Arabic RTL admin shell.

**Exit criteria (from README):** Two businesses on one deployment cannot see each other's data; a member with a custom role sees only what the role allows; admin works in AR/RTL.

**Session order and lanes:**
- P1.S1 (tenancy) first, alone.
- Then four lanes in parallel worktrees: **P1.S2 (auth)**, **P1.S3 (RBAC)**, **P1.S5 (admin shell)**, **P1.S6 (platform plumbing: outbox, webhook gateway, queues, secrets, flags, partitions)**.
- P1.S4 (team) starts after both P1.S2 and P1.S3 are merged; it may run alongside P1.S5 and P1.S6.
- P1.S6 is not needed by P2 but must be merged before P3.S4 (outbox) and P3.S5 (staging); start it early so it never blocks the critical path.
- Shared files that parallel sessions touch only by appending a registration line: `apps/server/src/vendure-config.ts` (plugin list), `packages/shared/src/index.ts` (exports), `apps/server/migrations`. Keep both lines on conflict.

Brief structure: [_session-template.md](_session-template.md). Rules: [CONTRIBUTING.md](CONTRIBUTING.md). ADRs in `docs/adr/` (0002 tenancy, 0003 ids, 0005 i18n, 0007 branding, 0008 public API auth, 0013 queues, 0016 data lifecycle) are binding; architecture reference: [../architecture/README.md](../architecture/README.md).

---

## P1.S1 — Business→Stores tenancy

| Field | Value |
|---|---|
| **Goal** | Implement the Business → Store(=Channel) tenancy model with host→store resolution, a tenant guard that enforces isolation, and a per-business order-number sequence. |
| **Branch** | `feat/p1-s1-tenancy` |
| **GitHub issue** | `P1.S1 Business→Stores tenancy` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P0.S2b merged (ADRs from P0.S2a binding). |
| **Parallel-safe** | No (everything in P1 depends on it). Owns `plugins/tenancy/`, `packages/shared/src/tenancy.ts`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered**
- "Business profile (logo, name) and onboarding state" (C, `/settings`) — whole row (data + API; settings UI polish in P1.S5).
- "Multi-store per business, store switcher with subdomain" (C, top bar) — **API part only** (create/list/switch stores); switcher UI is P1.S5.
- "Store profile: logo, name, description, language AR/FR/EN, default delivery fee group, default carrier, show address field" (C) — **data and API only**; storefront application is P3.S2, delivery group/carrier targets are placeholders until P3.S1/P5.S1.
- "Free subdomain (availability check, change)" — **subdomain field and availability endpoint only** (used by the P1.S2 sign-up wizard); changing the subdomain and DNS/custom domains are P8.S9, which ticks the row.
- "Sold-out behaviour: keep showing or hide; stop/resume orders" — **settings fields stored only**; behaviour is P2.S1, storefront side P3.S2.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- docs/roadmap/plans/P1.S1-plan.md (executable plan)
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P0.S2b.md` (and `P0.S2a-1.md`–`P0.S2a-3.md` for the ADR impact list), `docs/adr/0002-*` (tenancy, incl. spike C outcome), `0003-*` (ids), `0006-*` (host map), `0008-*` (auth), `0010-*` (dashboard host).
- `docs/architecture/system-design.md` §2.1 (host resolution on a page view), §5 (data: host map keys), §7 (tenant isolation).
- `docs/research/dashboard-captures.md` "Store settings → Profile" and "Business settings"; `docs/research/data-model.md` intro (businessId/storeId on every row) and "Order" (`orderNumber` "#00000001", per-business sequence); `docs/research/second-pass.md` "Onboarding (new account)" (store address `<sub>.platform` with live availability check).
- `docs/research/api-surface.md` "Catalog & store" (`/stores`, `/stores/subdomain-availability`, `/businesses/:id`, `/business/:id/access`).

**High-level plan**
1. Entities in `plugins/tenancy`: `Business` (name, logo asset, onboardingState json, ownerUserId), `Store` (businessId, channelId, sellerId, name, description, logo, language ar/fr/en, subdomain unique, defaultDeliveryFeeGroupId?, defaultCarrierId?, showAddressField, soldOutBehavior keep/hide) with migration; Seller per Business, Channel per Store → commit `feat(tenancy): business and store entities mapped to channel and seller`.
2. Tenant context: `TenantContext` on `RequestContext` (businessId, storeIds, activeStoreId), guard + decorator `@TenantScoped`, base `TenantEntity` (businessId/storeId) and a repository/query helper that always filters by tenant; fail closed when no tenant. Any per-request Postgres state (e.g. `app.business_id`) is set only with `set_config(name, value, true)` inside a transaction, never a session `SET`, session advisory lock or `LISTEN` through the PgBouncer transaction pooler, enforced by a lint/grep check (ADR 0016 §6) → commit `feat(tenancy): tenant guard and scoped query helper`.
3. Host→store resolver service (platform-domain subdomain `<store>.<platform>.com.dz`, ADR 0011/0012, custom-domain table stub for P8.S9) with in-process LRU (60 s) + Valkey host map (host:{host}) + pub/sub invalidation on subdomain/domain change (ADR 0006), exposed as `GET /store/resolve?host=` (internal-only once P1.S6 lands the internal HMAC guard) for the storefront and wired into `apps/storefront` `proxy.ts` replacing the P0.S2b stub → commit `feat(tenancy): host to store resolver wired into storefront`.
4. API: GraphQL admin mutations/queries for Business profile, create/list/update Store, `subdomainAvailability(subdomain)` (reserved words, 3–30 chars, `[a-z0-9-]`), store settings update; REST `/stores/subdomain-availability` for the sign-up wizard. Store creation relies on `GlobalSettings.availableLanguages = [ar, fr, en]` (seeded by P0.S2b; otherwise Vendure fails with `LANGUAGE_NOT_AVAILABLE_ERROR`, ADR 0002) and asserts it → commit `feat(tenancy): business and store api with subdomain availability`.
5. Per-business order-number sequence service (`nextOrderNumber(ctx, businessId)` → `#00000001`): one counter row per business (`UPDATE … SET last = last + 1 … RETURNING last`) run **inside the caller's transaction**, so a rolled-back intake burns no number; the number is stored in `Order.customFields.orderNumber` and assigned when the order enters `Pending`, not via `OrderCodeStrategy` (ADR 0009) — exported for P3.S4; domain constants in `packages/shared` → commit `feat(tenancy): per-business order number sequence`.
6. Isolation integration tests: two businesses, two stores each; every tenancy query/mutation, resolver and sequence checked for cross-tenant leakage → commit `test(tenancy): two-business isolation suite`.

**Deliverables**
- `plugins/tenancy` (entities, migrations, services, guard, resolver, GraphQL + REST), shared types/constants, storefront `proxy.ts` wiring, seed script creating two demo businesses, docs section in ADR 0002 "as implemented".

**Acceptance criteria**
- [ ] Creating a Store creates a Channel and links it to the Business's Seller; deleting/archiving a Store is soft.
- [ ] `subdomainAvailability('demo')` returns available/taken/reserved/invalid with reason; case-insensitive; uniqueness enforced by DB constraint.
- [ ] `GET /store/resolve?host=demo.localhost` returns `{ storeId, businessId, language, name, logo }`; unknown host returns 404; after a subdomain change every API process (two in the test) stops resolving the old host within 1 s (Valkey pub/sub invalidation of the in-process LRU and the `host:{host}` key).
- [ ] Order numbers are `#` + 8 digits, start at `#00000001` per business, independent across businesses, no duplicates and no gaps in a 50-way concurrent test that includes rolled-back transactions (ADR 0009).
- [ ] The tenant helper only uses `set_config(…, true)` inside transactions; the lint/grep check fails on a plain `SET`, `pg_advisory_lock` or `LISTEN`; a test through PgBouncer shows no tenant state leaking to the next client (ADR 0016 §6).
- [ ] A user of Business A requesting Business B's store or business by id gets "not found" (not "forbidden") for every endpoint; a missing tenant context throws.
- [ ] Store settings fields from the Tassyir Profile tab round-trip: name, description, logo, language (AR/FR/EN), default delivery fee group, default agent, show address field, sold-out keep/hide.
- [ ] Storefront at `demo.localhost:3000` shows the store's real name from the DB.

**Verification**
- Unit: subdomain validation, sequence service, host parsing. Integration: all endpoints against test Postgres, concurrency test for the sequence.
- Browser check: storefront host resolution on two subdomains; compare store identity fields with "Store settings → Profile" in `dashboard-captures.md` (data only, UI in P1.S5).
- Multi-tenant check: the dedicated two-business suite (this session's core deliverable); also run it against `plugins/_template`'s entity as a reference.

**Out of scope**
- Sign-up/auth (P1.S2), roles (P1.S3), switcher UI (P1.S5), custom-domain DNS/TLS (P8.S9), plan limits on store count (P9.S1).

**Kickoff prompt**
```
You are running session P1.S1 "Business→Stores tenancy" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P1-foundation.md (section P1.S1), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p1-s1-tenancy from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P1.S1.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P1.S2 — Accounts & auth

| Field | Value |
|---|---|
| **Goal** | Register (3-step wizard), log in/out, verify email, reset/change password and email, profile and security pages, plus OAuth behind a flag. |
| **Branch** | `feat/p1-s2-auth` |
| **GitHub issue** | `P1.S2 Accounts & auth` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P1.S1 merged. |
| **Parallel-safe** | Yes with P1.S3, P1.S5, P1.S6. Owns `plugins/auth/`, `apps/server/src/email/` templates for auth, storefront-independent dashboard routes `login`, `register`, `forgot-password`, `profile`, `security` inside `plugins/auth/dashboard/` (unauthenticated routes go where ADR 0010 says they can live). |
| **Model / size** | Sonnet · M |
| **External needs** | Google/Facebook OAuth apps (mocked provider in tests, buttons hidden behind a flag). SMTP: Mailpit locally. |

**Inventory rows covered**
- "Register, login, logout, email verification (link + OTP), forgot/reset password, change password, change email" (C).
- "Google and Facebook sign-in" (I) — flag-gated, tested against a mocked provider; mark ticked only with that caveat in the PR.
- "Sign-up wizard (3 steps) with store name, live subdomain availability, store language, logo" (C).
- "Account menu: Profile (photo, name, phone), Security (change password), Notification settings…, Language, Light/Dark theme" — **Profile and Security only** (notification settings P7.S3; language/theme P1.S5).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- docs/roadmap/plans/P1.S2-plan.md (executable plan)
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P1.S1.md`, ADR 0002 and the auth decision in ADR 0008.
- `docs/research/second-pass.md` "Onboarding (new account)" (3 steps; step 3 "Name your store": store name, `<sub>` address with live "is available" check, store language "the language your customers shop in, not the dashboard", logo ≤5 MB).
- `docs/research/api-surface.md` "Auth & account" paths (`/auth/register`, `/auth/login`, `/auth/verify-email/:token`, `/auth/verify-email-otp`, `/auth/change-email-request`, `/auth/confirm-email-change`, `/auth/profile`) and the "Auth:" bullet (JWT claims `id, email, iat, exp`, Bearer; reference only: ADR 0008 uses Vendure session tokens, not JWT).

**High-level plan**
1. Auth strategy: Vendure `AuthenticationStrategy` for email+password on the Admin API (merchants and members are Administrators per ADR 0002); token type per ADR 0008: Vendure session tokens with `authOptions.tokenMethod: ['cookie','bearer']` (the dashboard sends Bearer); no custom JWT; secure cookie option; rate limiting on login → commit `feat(auth): email password strategy with bearer sessions`.
2. Register service: step 1 account (email, password, name), step 2 business (name), step 3 store (name, subdomain, language, logo ≤5 MB) calling P1.S1 services in one transaction; owner role placeholder (P1.S3 supplies real Owner) → commit `feat(auth): registration creating user, business and store`.
3. Email flows via Mailpit: verification link + 6-digit OTP (expiry, attempt limit, resend cooldown), forgot/reset, change password (needs current), change email request/confirm → commit `feat(auth): email verification, otp, reset and change flows`.
4. Dashboard pages (login, 3-step register wizard with live subdomain check debounced, forgot/reset, profile with photo/name/phone, security) → commit `feat(auth): dashboard auth pages and profile`.
5. OAuth (Google, Facebook) strategies behind `AUTH_OAUTH_ENABLED`, mocked provider integration tests; buttons hidden when flag off → commit `feat(auth): oauth sign-in behind feature flag`.
6. Tests and hardening (enumeration-safe responses, token single-use) → commit `test(auth): flows, expiry and enumeration safety`.

**Deliverables**
- `plugins/auth`; REST `/auth/*` mirroring the paths above plus GraphQL equivalents; email templates (AR/EN); dashboard pages; env docs in `.env.example`.

**Acceptance criteria**
- [ ] Wizard shows exactly three steps; step 3 disables Create until the subdomain is "available"; store language options are العربية / Français / English; successful submit lands on the Home route of the new business.
- [ ] Registration creates User + Business + Store(+Channel) atomically; a failure in step 3 leaves no orphan rows.
- [ ] Unverified accounts can log in but see a verify banner; link and OTP both verify; OTP expires and locks after 5 wrong tries.
- [ ] Forgot-password returns the same response for known and unknown emails; reset token is single-use; change password requires the current one and invalidates other sessions.
- [ ] Change-email sends confirmation to the new address and only switches after confirm.
- [ ] Profile saves photo, name, phone; phone stored E.164 (+213…).
- [ ] With the OAuth flag off the buttons are absent and endpoints return 404; with it on, the mocked provider test creates or links an account.

**Verification**
- Unit: token/OTP services, password policy, subdomain wizard validation. Integration: every endpoint incl. expiry and replay, emails captured from Mailpit API.
- Browser check: login/register/forgot pages vs "Onboarding (new account)" in `second-pass.md` (3 steps, store-name step).
- Multi-tenant check: user A cannot read or modify user B's profile; registering with a taken subdomain fails and does not create the business.

**Out of scope**
- Roles/permissions (P1.S3), team invitations (P1.S4), notification settings (P7.S3), plans/trial (P9.S1; the "7 days left" banner is a placeholder in P1.S5).

**Kickoff prompt**
```
You are running session P1.S2 "Accounts & auth" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P1-foundation.md (section P1.S2), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p1-s2-auth from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P1.S2.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P1.S3 — Permissions catalog & roles

| Field | Value |
|---|---|
| **Goal** | The 93-permission catalog, 7 built-in role templates, custom roles with per-area None/View/Full, store-scoped access and an activity log. |
| **Branch** | `feat/p1-s3-rbac` |
| **GitHub issue** | `P1.S3 Permissions catalog & roles` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P1.S1 merged. |
| **Parallel-safe** | Yes with P1.S2, P1.S5, P1.S6. Owns `plugins/rbac/`, `packages/shared/src/permissions.ts`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered**
- "Roles: 7 built-in templates; custom roles with name, description, start-from template; 93 permissions in 12 areas with None/View/Full per area and "Sensitive" flags (full list in research notes)" (C).
- "Activity log" (S, permission "View the activity log").
- "Commissions configs, role duplicate, permissions catalog, invitation resend/revoke" — **role duplicate and permissions catalog only**; commissions and invitations are P1.S4.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- docs/roadmap/plans/P1.S3-plan.md (executable plan)
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P1.S1.md`, ADR 0002.
- `docs/research/dashboard-captures.md` "Team" → "New role dialog" (the full 12-area list with sensitive `*` marks, counts: Orders 19, Order tracking 3, Products & catalog 8, Offers 4, Inventory 4, Finance 7, Analytics 2, Team & roles 12, Delivery 8, Store & storefront 15, Apps & integrations 8, Settings 3 = 93) and "Roles: built-in Owner, Manager, Order Manager, Inventory Manager, Accountant, Orders Tracker, Store Manager; table Role, Members, Access, Updated".
- `docs/research/api-surface.md` "Team" (`/roles/:id`, `/roles/:id/duplicate`, `/permissions`, `/permissions/catalog`).

**High-level plan**
1. `packages/shared/src/permissions.ts`: typed catalog (key, area, label EN/AR, `sensitive`, minimum level View/Full) of all 93 permissions, with a test asserting counts per area and the sensitive set → commit `feat(shared): permission catalog of 93 permissions in 12 areas`.
2. `plugins/rbac`: register each as a Vendure `PermissionDefinition` (custom permissions), namespaced keys; `BusinessRole` entity (businessId, name, description, builtIn, templateOf, permissions[], updatedAt) mapped onto Vendure Roles scoped to the store channels; guard helper `requirePermission(key)` → commit `feat(rbac): custom permission definitions and business roles`.
3. Seed the 7 built-in templates per business (Owner = all 93; others per the Tassyir meaning: Order Manager = orders + customers, Inventory Manager = inventory + products, Accountant = finance + view orders, Orders Tracker = tracking, Store Manager = store & catalog, Manager = everything but sensitive billing/delete) → commit `feat(rbac): seed built-in role templates`.
4. Custom roles API: create/update/delete/duplicate; start-from template; per-area None/View/Full expands to permission sets; per-permission toggles; cannot edit/delete built-ins; cannot delete a role in use; `GET /permissions/catalog` → commit `feat(rbac): custom roles with area levels, duplicate and catalog endpoint`.
5. Store-scoped access: a member's role assignment carries `storeAccess` (all | selected stores); checks resolve permission per active store → commit `feat(rbac): store-scoped role assignment`.
6. Activity log: `ActivityLog` entity (businessId, storeId?, actorId, action key, entityType/id, summary, diff json, ip, createdAt), `ActivityLogService.record()` hooked on EventBus for rbac events (extension point for later sessions), list query behind "View the activity log" → commit `feat(rbac): activity log storage and query`.
7. Dashboard Roles table + New role dialog (Name, Description, Start from, area levels, toggles, Sensitive badge) → commit `feat(rbac): roles dashboard page`.

**Deliverables**
- `plugins/rbac`, shared catalog, GraphQL (`roles`, `createRole`, `duplicateRole`, `permissionCatalog`, `activityLog`) and REST `/permissions/catalog`, `/roles`, dashboard Roles page.

**Acceptance criteria**
- [ ] Catalog has exactly 93 permissions in 12 areas with the counts above; sensitive flags match the research list (e.g. "view every member's orders", "delete orders", "cancel orders", "create returns", "delete comments", "give discount", "see buy prices", "publish", "discard", "edit business/plan/billing").
- [ ] Setting an area to "View" grants only the view permissions of that area; "Full" grants all; "None" none; per-permission toggles override.
- [ ] New role dialog "Start from" copies a template's permissions; Duplicate creates "<name> (copy)" with identical permissions.
- [ ] A user with a custom role lacking `orders.cancel` gets a permission error from a test mutation guarded by it; a Full-Orders user passes.
- [ ] Store access "only these stores" denies the same permission on a store outside the list.
- [ ] Every role create/update/delete writes an activity-log row with actor and diff; the log is hidden without "View the activity log".

**Verification**
- Unit: catalog invariants, area-level expansion, permission resolution with store scope. Integration: role CRUD, guard behaviour via test resolvers.
- Browser check: Roles table and New role dialog vs "Team → New role dialog" in `dashboard-captures.md` (area switches, Sensitive marks).
- Multi-tenant check: business A cannot list, edit, duplicate or assign business B's roles; built-in role seeds exist per business.

**Out of scope**
- Inviting/assigning members (P1.S4), applying permissions inside later feature plugins (each owns its own guards using this catalog), sidebar hiding by permission (P1.S5 reads the catalog).

**Kickoff prompt**
```
You are running session P1.S3 "Permissions catalog & roles" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P1-foundation.md (section P1.S3), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p1-s3-rbac from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P1.S3.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P1.S4 — Team members & invitations

| Field | Value |
|---|---|
| **Goal** | Team members list, email invitations with roles/store access/salary/commissions, and member actions. |
| **Branch** | `feat/p1-s4-team` |
| **GitHub issue** | `P1.S4 Team members & invitations` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P1.S2 and P1.S3 merged. |
| **Parallel-safe** | Yes with P1.S5, P1.S6. Owns `plugins/team/`. |
| **Model / size** | Sonnet · M |
| **External needs** | SMTP (Mailpit locally). |

**Inventory rows covered**
- "Members list: All / Active / Pending / Inactive; roles, salary, status, order count, store access, joined" (C).
- "Invite by email with roles, store access (all / selected), base salary, commission structures" (C).
- "Member actions: view details, edit, set limit (max open orders), stop receiving orders, pay salary" (C) — pay salary records an expense placeholder, wired in P6.S4.
- "Team stats report and commissions" — **commission configs only**; stats report is P7.S1.
- "Commissions configs, role duplicate, permissions catalog, invitation resend/revoke" — **commission configs and invitation resend/revoke**; role duplicate/catalog were P1.S3.

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P1.S2.md`, `docs/roadmap/handoff/P1.S3.md`.
- `docs/research/dashboard-captures.md` "Team": members tabs and columns (Employee, Roles, Salary (DZD), Status, Orders, Store access, Joined, Actions: Pay salary, View Details, Edit, Set limit, Stop receiving orders) and "Invite dialog: Email*, Roles*, Store access (All / Only these stores), Base Salary (DZD)*, Commission Structures (Add Commission)".
- `docs/research/api-surface.md` "Team" (`/employees`, `/employees/:id`, `/employees/:id/pay`, `/employees/:id/revoke-invitation`, `/employees/resend-invitation`, `/employees/analytics/:id`, `/commissions/configs(/:id)`, `/commissions/configs/actions`, `/employees/order-managers`).
- `docs/feature-inventory.md` "Still not covered" and "Left out of the read-only walkthrough" notes (invitation emails and the salary "Pay" dialog were not exercised in the source; mirror the placeholder).

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #110 AUTH-2 (medium): fix(auth): void a pre-set password on the first provider link
- #111 AUTH-3 (medium): test(auth): cover otp-account limits against the real limiter
- #114 RBAC-3 (medium): fix(rbac): ignore soft-deleted administrators in membership checks
- #134 EV-3 (medium): docs(evidence): complete or note the single-viewport P1 screens
- #138 TEN-13 (medium): fix(tenancy): decide the fate of the two unused business permissions
- #139 FLAKY-1 (medium): test(rbac): stop the converge test racing a delayed session delete
- #141 RL-1 (low): fix(auth): take the pair token before checking the password
- #145 AUTH-1 (low): fix(auth): refuse an empty first name on the profile mutation
- #146 AUTH-4 (low): fix(auth): remove provider links when an account is soft-deleted
- #147 AUTH-5 (low): fix(auth): give the OAuth binding cookie the __Host- prefix
- #148 AUTH-6 (low): feat(auth): send a notice after a password reset
- #151 AUTH-9 (low): fix(auth): make OTP verification atomic
- #152 AUTH-10 (low): test(auth): fix the wrong body of one endpoint registry fixture
- #160 RBAC-4 (low): fix(rbac): apply reach checks to roles bound only to archived stores
- #161 RBAC-5 (low): docs(evidence): make the store-filtered activity log section real
- #162 RBAC-6 (low): fix(rbac): widen sanitizeDiff to the full D66 list
- #163 RBAC-7 (low): test(rbac): extend the D59 engine-grants test to plugin permissions
- #164 RBAC-8 (low): docs(rbac): record that templateOf was never built
- #211 CO-10 (low): test(rbac): prove the cross-process session flush in a test

**High-level plan**
1. Entities: `TeamMember` (businessId, userId?, email, status invited|active|inactive, roleIds, storeAccess, baseSalary, maxOpenOrders?, receivingOrders, invitedAt, joinedAt), `Invitation` (token hash, expiry, resendCount), `CommissionConfig` (businessId, name, basis e.g. per confirmed / per delivered order, amount or %, scope) → commit `feat(team): member, invitation and commission config entities`.
2. Invite flow: create invitation (email, roles, store access, salary, commissions), email via Mailpit, accept link creating or linking the user (reuses P1.S2 registration pieces), resend and revoke, expiry → commit `feat(team): invite, accept, resend and revoke`.
3. Members list API with tabs All/Active/Pending/Inactive, search, counts, order-count placeholder (real in P4.S1), store-access summary → commit `feat(team): members list query with status tabs`.
4. Member actions: view, edit (roles, access, salary), set limit, stop/resume receiving orders, deactivate, remove; `GET /employees/order-managers` helper for later pickers; pay salary creates a `SalaryPayment` placeholder row and emits an event for P6.S4 → commit `feat(team): member actions and salary payment placeholder`.
5. Commission configs CRUD + `commissions/configs/actions` list of supported bases (structure only; calculation arrives with analytics/finance) → commit `feat(team): commission configs`.
6. Dashboard: Team Members tab, Invite dialog, actions menu → commit `feat(team): team members dashboard page and invite dialog`.

**Deliverables**
- `plugins/team` (entities, services, GraphQL + REST `/employees`, `/commissions/configs`), email templates, dashboard Team page (Members tab; Distribution tab placeholder for P4.S4; Roles tab links to P1.S3).

**Acceptance criteria**
- [ ] Invite dialog requires Email, Roles (≥1) and Base Salary; store access "Only these stores" requires ≥1 store; Commission Structures optional with "Add Commission".
- [ ] Invitation email arrives in Mailpit; accepting creates an Active member with the chosen role and store scope; expired or revoked tokens fail; resend invalidates the previous token.
- [ ] Members table shows the columns listed in the research with Pending for invited, Inactive for deactivated; tab counts match filters.
- [ ] "Set limit" stores max open orders (exposed for P4.S4); "Stop receiving orders" flips `receivingOrders`; both visible in the list.
- [ ] Pay salary writes a placeholder payment (amount = base salary, date, actor) and emits `SalaryPaid`; no finance records yet.
- [ ] Every action requires the right catalog permission from P1.S3 (invite/view/remove/edit members, commissions).
- [ ] Inviting an email already in the business returns a clear error; the owner cannot be removed or demoted.

**Verification**
- Unit: invitation token lifecycle, status derivation, permission checks. Integration: full invite→accept→list flow with Mailpit; revoke/resend.
- Browser check: Team page, tabs, Invite dialog vs "Team" in `dashboard-captures.md`.
- Multi-tenant check: business A cannot list, edit or invite into business B; an invite token for A cannot create access to B; the same email may belong to two businesses independently.

**Out of scope**
- Order distribution and assignment (P4.S4), team stats and commission calculation (P7.S1), salary expense ledger (P6.S4), plan seat limits (P9.S1; call `requireFeature('team')` and `requireFeature` limits as no-ops).

**Kickoff prompt**
```
You are running session P1.S4 "Team members & invitations" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P1-foundation.md (section P1.S4), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p1-s4-team from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P1.S4.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P1.S5 — Admin shell, navigation & Arabic RTL

| Field | Value |
|---|---|
| **Goal** | The dashboard shell: sidebar IA, store switcher, top bar, account menu, light/dark, Arabic RTL, and empty route skeletons for every sidebar item. |
| **Branch** | `feat/p1-s5-admin-shell` |
| **GitHub issue** | `P1.S5 Admin shell, navigation & Arabic RTL` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P1.S1 merged. |
| **Parallel-safe** | Yes with P1.S2, P1.S3, P1.S4, P1.S6. Owns `plugins/admin-shell/` and `packages/shared/src/i18n/` (translation files `en.json`, `ar.json`; later sessions append keys). |
| **Model / size** | Sonnet · M |
| **External needs** | None. |

**Inventory rows covered**
- "Locale switch EN/AR with RTL layout" (C).
- "Arabic dashboard (RTL, IBM Plex Sans Arabic)" (C).
- "Store switcher with "Create Store"" (C) and "Multi-store per business, store switcher with subdomain" — **UI part** (API in P1.S1).
- "Account menu: …Language, Light/Dark theme" — **language and theme only**.

**Read first**
- docs/roadmap/plans/P1.S5-plan.md (executable plan)
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`, `docs/roadmap/handoff/P1.S1.md`, ADR 0005 (i18n), ADR 0007 (branding), ADR 0010 (dashboard host: how the built-in Vendure navigation is hidden/replaced for merchant users, or the own-admin-app layout).
- `docs/research/dashboard-captures.md` intro "Top bar: sidebar toggle, AI credits counter + Add credits, Ask Tassya, notifications bell, user menu, store switcher" and "Sidebar" (the exact tree: Home · Orders (Customers, Spam) · Tracking (Returns) · Products (Collections, Offers, Themes, A/B Testing) · Analytics (Team stats, Marketing) · Inventory (Packaging, Movements) · Finance (Costs, Products, Wilayas, Ads, Wallets, Product study) · Team (Order distribution, Roles & Permissions) · Delivery & Shipping · Apps · Sourcing · Settings (Pixels & Tracking, Domains, Plan & Billing, Status customization, Stock locations, Spam protection)).
- `docs/research/second-pass.md` "Onboarding (new account)" (trial banner "7 days left on your free trial" + Upgrade).

**High-level plan**
1. Navigation model in `plugins/admin-shell` (typed tree with route, icon, i18n key, permission key from the P1.S3 catalog when available, plan feature key) and registration API so later plugins fill pages; sidebar component with collapse toggle → commit `feat(admin-shell): sidebar navigation tree`.
2. Route skeletons for every sidebar leaf (empty page with title and "coming in P?.S?" hint hidden in production builds), including store-scoped routes under `/stores/:storeId/...` → commit `feat(admin-shell): empty route skeletons for all sidebar items`.
3. Top bar: store switcher (list from P1.S1 API, shows subdomain, "Create Store" dialog reusing store-name fields), trial banner placeholder, credits counter placeholder + "Add credits", "Ask assistant" placeholder button, notifications bell placeholder, account menu (Profile, Security links to P1.S2 pages, Language, Light/Dark) → commit `feat(admin-shell): top bar, store switcher and account menu`.
4. i18n infrastructure: `en`/`ar` message files, `t()` helper for dashboard extensions, locale persisted per user and in URL (`/en/…`, `/ar/…`), `dir="rtl"` on `<html>`, IBM Plex Sans Arabic self-hosted → commit `feat(admin-shell): i18n infrastructure and rtl direction`.
5. Arabic translation of every dashboard string added so far (shell, P1.S1 settings, and whatever is merged from P1.S2–S4 at the time; leave a script `i18n:check` that lists missing keys) + logical CSS properties audit (no left/right hard-coding) → commit `feat(admin-shell): arabic translations and rtl layout fixes`.
6. Light/Dark theme tokens with persisted preference; permission-aware item hiding stub (hide item if the user lacks the view permission once P1.S3 is merged, otherwise show all) using Vendure 3.8 per-user nav visibility (`ctx.hasPermissions`) and a custom `PlatformStaff` permission (ADR 0010). **Vendure's built-in order list and other built-in sections are hidden for merchant users** and stay staff-only (`PlatformStaff`): merchants reach orders only through our `cod_order`-backed Orders pages (ADR 0002, 0009 §9) → commit `feat(admin-shell): light dark theme and permission aware nav`.
7. Visible Vendure leftovers from `handoff/P0.S2c-polish.md`: the English "Administration" sidebar heading (hard-coded in `nav-main.tsx`; user decision 2026-11-08: resolve here, by replacing the navigation or a reviewed `vendure-patch`), the user menu's "Plans" link to vendure.io, and the stock favicon and `description`/`author` meta tags. The login footer stays until the ADR 0001 counsel question is settled.

**Deliverables**
- `plugins/admin-shell`, `packages/shared/src/i18n/{en,ar}.json`, `i18n:check` script, route skeleton registry documented in the handoff note (how later sessions replace a skeleton).

**Acceptance criteria**
- [ ] Sidebar shows the groups and children exactly as in the research tree (names are our own wording where Tassyir-branded; no "Tassyir"/"Tassya" strings; AI assistant is called by our placeholder name).
- [ ] Every sidebar leaf resolves to a page (no 404); store-scoped leaves use the active store id.
- [ ] Store switcher lists the business's stores with their subdomains, switching changes the active store and persists; "Create Store" creates a new Store via the P1.S1 API and switches to it.
- [ ] Switching to Arabic flips the whole shell to RTL (sidebar on the right, icons mirrored where directional), uses IBM Plex Sans Arabic, and `i18n:check` reports zero missing Arabic keys for strings that exist on main.
- [ ] Light/Dark toggle persists across reload and respects `prefers-color-scheme` on first visit.
- [ ] A merchant user does not see Vendure's built-in Orders list (or other staff-only built-in sections) in the nav and gets not-found/forbidden on its route; a `PlatformStaff` user still sees it (ADR 0010, 0002).
- [ ] Trial banner, credits counter, notifications bell and assistant button render as inert placeholders with documented hand-off sessions (P9.S1, P9.S2, P7.S3, P9.S7a).

**Verification**
- Unit: nav tree builder, permission filtering, locale resolution. Integration: i18n completeness script in CI; component tests for switcher.
- Browser check: sidebar and top bar in EN and AR, desktop and mobile width, vs "Sidebar" and top-bar notes in `dashboard-captures.md`; take RTL screenshots for the PR.
- Multi-tenant check: the store switcher only lists the signed-in user's business stores; changing the active store id in the URL to another business's store returns not found.

**Out of scope**
- Real content on any page (each owning session), real notifications (P7.S3), real credits (P9.S2), trial logic (P9.S1), storefront RTL (P3.S2).

**Kickoff prompt**
```
You are running session P1.S5 "Admin shell, navigation & Arabic RTL" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P1-foundation.md (section P1.S5), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p1-s5-admin-shell from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P1.S5.md` → commit → push → `gh pr create` → report PR link → stop.

---

## P1.S6 — Platform plumbing: outbox, webhook gateway, queues, secrets, flags

| Field | Value |
|---|---|
| **Goal** | Shared infrastructure plugins every later session reuses: transactional outbox with relay and sweeper, idempotent inbound webhook gateway, queue registry with pools, per-business semaphore and circuit breaker helpers, envelope-encrypted tenant secrets, operational feature flags, and partition maintenance. |
| **Branch** | `feat/p1-s6-platform-plumbing` |
| **GitHub issue** | `P1.S6 Platform plumbing: outbox, webhook gateway, queues, secrets, flags` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P1.S1 merged. |
| **Parallel-safe** | Yes, with P1.S2, P1.S3, P1.S4, P1.S5 (and P2.S1, P3.S1 if it is still open when they start). Owns `plugins/platform-outbox/**`, `plugins/platform-webhooks/**`, `plugins/platform-secrets/**`, `plugins/platform-flags/**`, `plugins/platform-partitions/**`, `packages/shared/src/queues.ts`, `packages/shared/src/outbox/**`, `packages/shared/src/internal-auth/**` (internal HMAC signer/verifier) and the storefront's internal API client `apps/storefront/src/lib/internal-api.ts` (switched to signed requests). Shared files only by appending a registration line: `apps/server/src/vendure-config.ts`, `packages/shared/src/index.ts`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered:** none directly (foundation for carriers, CAPI, webhooks, integrations).

**Read first**
- `CLAUDE.md` (repo root; session procedure) and this session's plan in `docs/roadmap/plans/` once written.
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P1.S1.md`, `P0.S2b.md`; `docs/adr/` 0002, 0008 (internal HMAC), 0013, 0016 (outbox, gateway, partitioning, pooling outcome of spike D).
- `docs/architecture/system-design.md` §2.3, §2.5, §5, §7 (tenant secrets), §10 (job reconciler, Valkey loss); `docs/architecture/README.md` "Review log" rows 1, 3, 4, 7.

**Audit issues to close** (from `docs/audits/P1-audit.md`; the session fixes each one, test first, or moves it to a named later session with the reason in its handoff)
- #107 TEN-2 (medium): fix(tenancy): invalidate host cache when a store is created
- #109 TEN-1 (medium): fix(shared): reserve the five subdomains ADR 0012 names
- #112 RL-3 (medium): test(rate-limit): cover the outage breaker and the return to Valkey
- #113 RBAC-2 (medium): feat(rbac): give activity_log retention and an append-only grant
- #115 SRV-2 (medium): fix(server): set lock_timeout and statement_timeout on migrations
- #116 SRV-3 (medium): fix(server): require APP_ENV instead of defaulting to development
- #118 HEALTH-1 (medium): fix(platform-health): stop returning raw driver errors from /readyz
- #126 PKG-7 (medium): fix(config): close the bypasses in the session SQL gate
- #136 RL-4 (medium): fix(server): require CLIENT_IP_HEADER in staging too
- #142 RL-2 (low): fix(rate-limit): keep lockouts when one Valkey call fails
- #143 RL-5 (low): fix(rate-limit): use the Valkey clock in the token bucket script
- #144 RL-7 (low): test(rate-limit): cover aliased fields and RateLimitedFilter
- #155 TEN-7 (low): fix(tenancy): compute the worker-id lease expiry before the call
- #156 TEN-9 (low): docs(evidence): regenerate the P1.S1 availability transcript
- #157 TEN-10 (low): test(tenancy): give the noForeignTarget isolation rows an assertion
- #158 TEN-11 (low): fix(tenancy): validate and namespace host cache entries
- #166 HEALTH-2 (low): fix(platform-health): log failed readiness probes
- #167 HEALTH-3 (low): fix(platform-health): stop /livez callers resetting the lag sample
- #168 HEALTH-4 (low): fix(platform-health): re-check the Valkey eviction policy
- #169 HEALTH-5 (low): fix(platform-health): cancel the probe query on timeout
- #185 SRV-6 (low): test(server): pin asset paths inside the assets/ prefix
- #186 SRV-7 (low): test(server): run every migration down and up again
- #187 SRV-8 (low): fix(server): validate secrets by strength, not by marker only
- #188 SRV-9 (low): fix(server): refuse PLATFORM_DOMAIN=platform.invalid when deployed
- #189 SRV-10 (low): fix(server): run the API in prod mode in staging
- #190 SRV-11 (low): fix(server): set the session cookie Secure flag explicitly
- #191 SRV-12 (low): fix(server): keep scheduled tasks off the migrate role
- #192 SRV-13 (low): fix(server): add a timeout to the migrate advisory lock

**High-level plan**
1. Queue registry and pools in `packages/shared/src/queues.ts` (names, priorities, retries/backoff, pool membership), worker `activeQueues` from env `WORKER_POOL=critical|bulk|all`, `withBusinessSemaphore()` and `withCircuitBreaker()` helpers on Valkey → commit `feat(platform): queue registry, pools, semaphore and breaker helpers`
2. `outbox_event` + `outbox_delivery` (daily partitions, no global unique key), `OutboxService.add(ctx, …)` requiring an active transaction, afterCommit relay to BullMQ with `jobId = outbox.id`, consumer registry with `{outboxId}:{consumer}` job ids and consumer-owned terminal states, `outbox-sweeper` (pending > 60 s) and `job-reconciler` (non-terminal durable rows past SLA, same jobId) scheduled tasks, metrics `outbox_pending`/`outbox_oldest_age_seconds`/`scheduler_task_last_success_age_seconds` → commit `feat(platform-outbox): transactional outbox with relay, sweeper and reconciler`
3. Inbound webhook gateway `POST /webhooks/:provider/:accountKey` with `InboundWebhookHandler` registry (`resolveAccount`, `verify`, `eventKey`, `process`), 256 KB cap, non-partitioned dedupe table `inbound_webhook_key` (PK `(provider, account_id, event_key)`, 30-day batched purge) + `inbound_webhook` payload table (daily partitions, `status`), enqueue to `inbound-webhooks`, 200 within 100 ms; plus `InternalOnlyGuard` for `/shop-api`, `/store/*`, `/_internal/*` (internal HMAC over method, path, timestamp, store/IP/country headers and body hash, 60 s skew), with the storefront's internal API client (incl. the P1.S1 `/store/resolve` call) switched to signed requests → commit `feat(platform-webhooks): idempotent inbound gateway and internal-only guard`
4. `TenantSecretService`: AES-256-GCM envelope encryption (per-business DEK wrapped by versioned KEK from env), write-only GraphQL input type, "last 4" display, KEK rotation job → commit `feat(platform-secrets): envelope-encrypted tenant secrets`
5. `feature_flag` entity (platform/plan/business/store scope, rollout %), Valkey cache + pub/sub invalidation, `flags.isEnabled(ctx, key)`, staff-only GraphQL to toggle; seed kill switches (incl. `intake.spool.enabled` for P3.S4) → commit `feat(platform-flags): operational flags and kill switches`
6. Partition helper (create table … partition by range, create next N partitions, detach/drop by retention policy, drop guarded for undelivered outbox rows) + `partition-maintenance` scheduled task; tests with time travel → commit `feat(platform-partitions): native partition maintenance`

**Deliverables:** the five plugins, shared queue/outbox/internal-auth types, migrations, scheduled tasks (`outbox-sweeper`, `job-reconciler`, `partition-maintenance`, inbound-key purge, KEK rotation), signed storefront internal client, docs section in ADR 0016 "as implemented".

**Acceptance criteria**
- [ ] An outbox row written in a transaction that rolls back is never relayed; one committed while the relay is killed (simulated crash) is enqueued by the sweeper within 2 min; a consumer runs once per row even if the relay runs twice.
- [ ] The same webhook body posted 5 times concurrently, and once more the next day, creates 1 `inbound_webhook` row and 1 processing job; an invalid signature returns 401 and enqueues nothing; p95 response < 100 ms in the integration test.
- [ ] Flushing Valkey (`FLUSHALL`) with jobs waiting, delayed and retrying: within 10 min the reconciler has re-enqueued every non-terminal outbox delivery and inbound webhook, and each consumer still runs exactly once in effect (idempotency checks).
- [ ] `/shop-api`, `/store/*` and `/_internal/*` return 403/404 on every host without the internal HMAC; a signed request with a modified `x-store-id` or body is rejected; the storefront still resolves `demo.localhost` through the signed client.
- [ ] A schema test fails if a unique index on a partitioned table does not include the partition key.
- [ ] A secret written for business A cannot be read by business B (not found), is never returned by any query, and survives KEK rotation.
- [ ] `withBusinessSemaphore` limits a business to N concurrent jobs while other businesses proceed; the breaker opens after 5 failures in 2 min and half-opens after 60 s.
- [ ] Partition maintenance creates future partitions and drops expired ones per policy; inserting a row for a date without a partition fails loudly in tests (not silently into a default partition).

**Verification**
- Unit + integration (Vendure test server, Postgres, Valkey): outbox rollback/crash/double-relay, gateway concurrency and replay, FLUSHALL recovery, HMAC tamper matrix, KEK rotation, semaphore/breaker timing, partition time travel.
- Browser check: staff flags screen only (no reference-product screen to compare; note it).
- Multi-tenant: two-business tests for secrets, flags, outbox payload `businessId`, gateway account resolution (a webhook for business A's account key never touches business B's data).

**Out of scope:** real carrier/payment handlers (P5, P9), CAPI/webhook consumers (P9.S3, P9.S8a), intake spool (P3.S4), staging deployment (P3.S5).

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P1.S6 "Platform plumbing: outbox, webhook gateway, queues, secrets, flags" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P1-foundation.md (section P1.S6), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch feat/p1-s6-platform-plumbing from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P1.S6.md` → commit → push → `gh pr create` → report PR link → stop.
