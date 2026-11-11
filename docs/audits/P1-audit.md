# P1 audit: everything merged through PR #99

Audited commit: `596947c` on `main` (P0, P1.S1, P1.S2, P1.S3, P1.S5). Date: 2026-11-11.

Out of scope: branch `feat/p1-s6-platform-plumbing`, P1.S4, Vendure core, new features.

## Summary

- **No critical finding.** No cross-tenant read or write, no auth bypass and no leaked secret was found in any module.
- **Six high findings**, five of them in the gates that are meant to keep the code modular and tenant-safe, one in the plugin template. No code on `main` exploits any of the gate gaps today; they are holes a later session could fall through unnoticed.
- **Modularity holds on `main`.** Zero layer-direction violations, zero framework imports in any `domain/`, zero cross-plugin imports outside declared entry points. Two small violations exist (M1, M2 below).
- Medium and low findings are listed as follow-ups, each with an owning session.

## Method

1. **Verify.** Ten fresh agents, one per module, each read only its module, its handoffs and its decisions, and returned findings with a file and line, a failing scenario and how it was checked. Modules: tenancy, auth, rate-limit, rbac, merchant-shell, platform-health with `_template`, the three packages, `apps/server`, `apps/storefront`, CI with the evidence scripts.
2. **Disprove.** Five further agents, with no access to the first agents' reasoning, tried to break every high and medium finding. Gate findings were tested by running the real gate on the claimed bypass. Verdicts below are theirs.
3. **Measure.** An AST script built the import graph of 913 source files. Lint, `test:arch`, `i18n:check`, typecheck, and each plugin's unit and integration tests were run on a clean worktree of `main`.

A finding is listed as confirmed only when the second agent could not break it. Where the second agent corrected the statement or the severity, the corrected version is the one shown.

## High findings (fixed in Phase 4)

| ID | Module | Where | What is wrong | Failing scenario | How it was confirmed |
|---|---|---|---|---|---|
| H1 | CI | `turbo.json:8-9`, `.github/actions/setup/action.yml:34-39` | `typecheck` and `test` have no `dependsOn`, so a task's cache key covers only its own package, while packages read workspace dependencies from source. CI restores `.turbo` by prefix. | A PR changes only `packages/shared/src/**` and breaks a unit test or the test and dashboard types of `plugins/rbac`. The rbac `test` and `typecheck` tasks hit the cache and CI is green. `build` excludes `tests` and `dashboard`, and integration does not run unit tests, so nothing else catches it. | `turbo run test typecheck --dry=json` shows `dependencies: []` and inputs only under `plugins/rbac/`. A two-package scratch repo with the same shape kept the dependent's hash after the dependency changed. Not yet observed in CI: the last three runs had no cache hit. |
| H2 | config | `packages/config/eslint/index.mjs:26,214-225` | The §3a.9 rule matches only `.getRepository` and `.rawConnection` member expressions, and only in `plugins/*/infrastructure/**` and `plugins/*/api/**`. | Each of these passes lint: `this.ds.manager.find(StoreEntity)`, `this.ds.query('select * from store')`, `this.ds.createQueryBuilder()`, `this.connection.getEntityOrThrow(ctx, StoreEntity, id)`, `const { rawConnection } = this.connection`, `this.connection['rawConnection']`; and `getRepository` in `application/`, `x.plugin.ts`, `index.ts` or `apps/server/src`. | Every snippet was linted with the real config through the gate tests' helper; none fired. Existing uses of the unguarded shape (`plugins/platform-health/platform-health.plugin.ts:56,58`, `apps/server/src/seed/*`) touch no tenant table. |
| H3 | config | `packages/config/architecture/handler-permissions.ts:11-73` | The gate that must fail any handler without `@Allow` or `requirePermission` is a narrow syntactic scan. | Not reported: a handler inherited from an undecorated base class (Nest routes it: `@nestjs/core/metadata-scanner.js:35,73`); an aliased or namespaced decorator (`Query as GqlQuery`, `@gql.Query()`); `@Sse` and `@Search`; a class inside a function or a class expression; any file under a folder named `dashboard` or `tests` at any depth (`plugins/x/api/dashboard/stats.resolver.ts`); `@Allow(...[])`; a local function named `requirePermission`. | Each shape was fed to `findUnguardedHandlers`; all returned no violation while the control case was reported. No handler on `main` uses any of these shapes. |
| H4 | config | `packages/config/architecture/check.ts:22` | `EXCLUDED_PATHS` is the unanchored pattern `node_modules\|dist\|…`, so any path containing "dist" is not checked by dependency-cruiser. | `plugins/x/application/district-pricing.service.ts` importing `../infrastructure/y` is not cruised and not reported; the identical `pricing.service.ts` is. | Run through `checkArchitecture` on a fixture workspace. No file on `main` has "dist" in its name. |
| H5 | config | `packages/config/architecture/rules.ts:44-106`, `packages/config/architecture/check.ts` | ESLint boundaries treats `@cod/plugin-*` imports as external, so dependency-cruiser is the only gate for the import form the code really uses, and it cannot resolve three cases. | (a) `plugins/_template/domain/x.ts` importing its own entry `@cod/plugin-template` passes both gates, which voids domain and application purity. (b) A server layer importing `@cod/plugin-merchant-shell/shell-api` passes, because the export has only the `@cod/source` condition. (c) A dashboard importing `@cod/plugin-tenancy` passes, against D92. (d) `application/x.ts` with `export type C = import('@vendure/core').TransactionalConnection` passes, because application purity is ESLint-only and the selector misses that form. | Each case run through ESLint and dependency-cruiser. Every existing fixture uses a relative path, which is why the tests stayed green. |
| H6 | `_template`, rbac | `plugins/_template/api/template-note.resolver.ts:38,48,59`, `plugins/_template/api/permissions.ts:4`, `packages/config/architecture/rules.ts:54-66` | The documented guard `requirePermission('<area>.<action>')` (D58) is exported by rbac but no other plugin may import it: the arch rule allows only the tenancy and rate-limit entries. The template and its README still teach its own `CrudPermissionDefinition` with `@Allow`, with no catalogue key and no `ENGINE_GRANTS` entry. | A plugin copied from the template passes every gate, and every role except Owner gets FORBIDDEN with no way to grant the permission in the product. The template's tests hide this by granting through a raw Vendure role (`packages/testing/src/business-member.ts:65-80`), a state production cannot reach. | Read by both agents; the sceptic corrected the first statement: `ENGINE_GRANTS` (D59) is a second sanctioned path, and the template uses neither. |

## Modularity (CLAUDE.md §3a)

### Import graph

Built from the TypeScript AST of every `.ts`, `.tsx`, `.mts` and `.mjs` file under `plugins/`, `packages/` and `apps/` (913 files): static imports, re-exports, dynamic `import()` and `require`.

| Check | Result |
|---|---|
| Layer direction `api` → `application` → `domain`, `infrastructure` → ports | 0 violations |
| `domain/` importing Nest, TypeORM, Vendure, Express, ioredis or GraphQL | 0 |
| A server layer importing `dashboard/`, or the reverse | 0 |
| Imports of a workspace subpath that the package does not export | 0 |
| Cross-plugin imports outside a declared entry point | 0 in plugin code; 1 in a server test (M1) |

Plugin-to-plugin edges (import count, of which in tests):

| From | To | Entry | Imports |
|---|---|---|---|
| auth | tenancy | `.` | 6 (2) |
| auth | rate-limit | `.` | 16 (4) |
| auth | merchant-shell | `./shell-api` | 7 (0), dashboard only |
| rbac | tenancy | `.` | 30 (7) |
| rbac | tenancy | `./provisioning` | 2 (0), `infrastructure/` only |
| rbac | rate-limit | `.` | 4 (1) |
| rbac | merchant-shell | `./shell-api` | 1 (0), dashboard only |
| tenancy | rate-limit | `.` | 4 (1) |
| `_template` | tenancy | `.` | 8 (3) |

rate-limit, merchant-shell and platform-health import no other plugin. `apps/storefront` imports only `@cod/shared`. `apps/server` imports plugins by package root only, except M1.

### Violations found

| ID | Where | What | Would lint or `test:arch` catch it? |
|---|---|---|---|
| M1 | `apps/server/tests/browser/auth-flows.browser.test.ts:3` | Relative import of `plugins/auth/dashboard/constants`, a plugin internal. | No. `apps-no-plugin-internals` (`rules.ts:90`) matches layer folders in `src` only, and boundaries skips local files that match no element. Fixed in Phase 4 with the rule. |
| M2 | `plugins/tenancy/tenancy.plugin.ts:225` | `RateLimitPlugin.options ??= {…}`: tenancy writes another plugin's static state, so a host that forgets `RateLimitPlugin.init` boots silently with a blank client-IP header. | No rule. Fixed in Phase 4 with a lint rule against assigning to an imported plugin's static member. |
| H5, H6 | see above | Missing or unresolvable rules. | No; that is the finding. |

### Size and shape

| Check | Result |
|---|---|
| Files over 300 lines | 1 in source: the generated `apps/server/src/migrations/1794078924166-init.ts` (735, exempt by rule). `plugins/auth/application/oauth-sign-in.service.ts` and three test files sit exactly at 300. |
| Functions over 40 lines in source | The generated migration's `up` and `down`, and `codEslintConfig` in `packages/config/eslint/index.mjs:144` (about 94 lines; `.mjs` files get no size rule, see PKG-9). |
| `eslint-disable` | 11: 8 `no-extraneous-class` on plugin classes, 3 `no-deprecated`. None for size, `any`, boundaries or the raw-access rule. |
| `any`, `@ts-ignore`, `@ts-expect-error` | 0. But `as unknown as` appears 72 times, 29 outside tests (PKG-10). |
| Skipped, `todo` or `only` tests | 0. One deliberate `it.fails` in `apps/server/tests/e2e/active-queues.e2e.test.ts:83`. |
| Empty `catch` | 0 |
| Shared `switch` that should be a registry | None. Two `switch` statements in source, both over a closed local union (`shell-leaf-page.tsx:64`, `permissions/expand.ts:53`). |
| God services | None found; the largest service is the 300-line OAuth sign-in. |

### Each plugin's tests alone

Run one at a time with `pnpm --filter <package> test` and `test:integration` against a fresh data stack.

| Plugin | Unit | Integration |
|---|---|---|
| tenancy | 69 passed | 229 passed |
| auth | 144 passed | 274 passed |
| rate-limit | 45 passed | 17 passed |
| rbac | 176 passed | 211 passed |
| merchant-shell | 92 passed | no integration suite |
| platform-health | 28 passed | 7 passed |
| `_template` | 15 passed | 28 passed |

### "If this plugin has a bug, which other packages must change?"

| Plugin | Answer | Finding? |
|---|---|---|
| rate-limit | Itself. Consumers use the entry point only. | No |
| platform-health | Itself. | No |
| merchant-shell | Itself, unless the fix changes `shell-api`, a declared contract used by the auth and rbac dashboards. | No |
| tenancy | Itself, unless the fix changes its entry point or `./provisioning`. One exception: it sets rate-limit's options (M2), so a rate-limit configuration bug can sit in tenancy. | M2 |
| auth | Itself. Its email templates live in `apps/server/src/email/` and are injected through `AuthPlugin.init` (D32), so a template bug is fixed in `apps/server`, by design. | No |
| rbac | Itself. Its catalogue lives in `packages/shared/src/permissions` (a shared contract). A new plugin permission needs an `ENGINE_GRANTS` entry in rbac, by design (D59). | No, but see H6 |
| `_template` | Itself. Any plugin copied from it inherits H6 and the follow-ups TPL-2 and TPL-7. | H6 |

### Would the gates catch each violation?

| Violation | Caught today | After Phase 4 |
|---|---|---|
| Layer direction by relative import | Yes (boundaries and dependency-cruiser, with firing fixtures) | Yes |
| Cross-plugin internal by relative path | Yes | Yes |
| Cross-plugin or own-entry import by package name | Only when dependency-cruiser resolves it (H5) | Yes |
| Raw tenant-table access | Two property names in two folders (H2) | Yes |
| Unguarded handler | Plain shapes only (H3) | Yes |
| File with "dist" in its path | Not checked (H4) | Yes |
| `apps` importing a plugin internal from a test (M1) | No | Yes |
| A plugin writing another plugin's static options (M2) | No | Yes |
| Stale `typecheck` or `test` from cache (H1) | No | Yes |

One more gate defect, low: `pnpm test:arch` fails 15 tests when the checkout sits under a `.claude/` folder, because the ESLint config ignores `.claude/**` and the fixture paths then count as unknown files. It passes (228 tests) in any other location. Owner: M.S1.

## Medium findings (follow-ups)

Not fixed in this audit. Each has an owning session; the owner's brief gets a line in the PR that merges this report's follow-up table, or at the session's start.

| ID | Where | Finding (as corrected by the second agent) | Owner |
|---|---|---|---|
| TEN-2 | `plugins/tenancy/application/create-store.service.ts:54-64` | Store creation and provisioning never invalidate the host cache, and a renamed-away subdomain is free at once. If the old host's cache entry survived (delete retries exhausted, or a hard kill between commit and invalidate), another business that takes the name has its buyers resolved to the previous store for up to 24 h. | P1.S6 |
| TEN-3 | `plugins/tenancy/api/tenant-scoped.decorator.ts:5`, `tenancy.plugin.ts:150` | Archive and suspension are enforced only on `@TenantScoped` handlers; ADR 0002 describes a global guard. Harmless while merchants hold only `Authenticated`; real as soon as a stock permission is granted. | P2.S1, before the first stock grant |
| TEN-1 | `packages/shared/src/tenancy/subdomain.ts:7-23` | The reserved list lacks `fallback`, `stores`, `staging`, `docs`, `blog` from ADR 0012:34. Two of them are infrastructure host names. | P1.S6 (one line; P8.S9 owns the list later) |
| AUTH-2 | `plugins/auth/application/email-verification.service.ts:44-49`, `oauth-sign-in.service.ts:293-300` | Pre-hijack residual: an attacker registers a victim's address with their own password; the victim clicks the confirmation mail; a later Google sign-in auto-links into the account the attacker still controls. Narrowed by D36 and D50 but not recorded as accepted. | P1.S4, or a decision row |
| AUTH-3 | `plugins/auth/application/email-verification.service.ts:57,62` | `otp-account` and `otp-account-daily` (D44) are tested only against a fake throttle. | P1.S4 |
| RL-3 | `plugins/rate-limit/tests/integration/valkey-outage.int.test.ts:69-80` | The outage breaker and the return to Valkey have no test that can fail; lockouts are not carried across the switch in either direction. | P1.S6 |
| RBAC-2 | `apps/server/src/migrations/1794239245984-rbac.ts:6-10` | `activity_log` has no retention, no partitioning and is mutable by the app role. D65 defers to P1.S6, whose brief does not name the table. | P1.S6 (partition); P10.S2 (append-only grant) |
| RBAC-3 | `plugins/rbac/infrastructure/vendure-actor-directory.ts:40-42` | Soft-deleted administrators keep their role assignments: roles stay "in use" and a deleted co-owner still counts as an Owner holder. Reachable today only by platform staff. | P1.S4 (member removal) |
| SRV-1 | `apps/server/src/config/auth-env.ts:24-74`, `plugins/auth/infrastructure/nodemailer-email-sender.ts:26-33` | No authenticated SMTP relay can be configured, STARTTLS is opportunistic, and production boots with `SMTP_HOST=mailpit`. Mailpit binds to 127.0.0.1 by default, which is why this is not high. No session owned it. **Resolved 2026-11-11** (`fix/audit-smtp-config`, D96): `SMTP_USERNAME`, `SMTP_PASSWORD` and `SMTP_TLS` are validated at boot, `starttls` sets `requireTLS`, and a deployed server defaults to `starttls`, so mail to a Mailpit left in a production `.env` fails instead of leaving in clear. | Resolved |
| SRV-2 | `apps/server/src/roles/migrate.role.ts:44-59` | ADR 0016 §5's `lock_timeout` and `statement_timeout` on migrations are not set; four migrations alter `administrator`. | P1.S6 |
| SRV-3 | `apps/server/src/config/env.ts:90` | `APP_ENV` defaults to `development`, so the image started outside compose accepts placeholder secrets, enables introspection and sets an insecure OAuth cookie. | P1.S6 |
| SRV-4 | `apps/server/src/roles/migrate.role.ts:99-111` | One business that cannot converge makes `migrate` exit 1, and no api or worker starts for anyone. By design (D57), but with no repair path. | P10.S2 |
| HEALTH-1 | `plugins/platform-health/application/readiness.service.ts:7,25-28` | Anonymous `/readyz` returns raw driver error text (host, port, database user). Assigned to P3.S5, which may not edit source. | P1.S6 |
| SF-1 | `apps/storefront/instrumentation.ts:11-13` | `INTERNAL_API_URL` is not validated at boot: the storefront reports ready while every page answers 500. | P3.S2 |
| SF-2 | `docs/roadmap/handoff/P0.S2b-5.md:93,165-173` | Cache safeguards (entry size limit, writes-off switch, memory guard, tag-set race) were deferred to P3.S5, which edits no source. The cache shares a `noeviction` Valkey with the job queues. | P3.S2 step 7 |
| SF-4 | `apps/storefront/cache/lazy-redis-client.ts:35` | No socket timeout on the cache client: a Valkey that accepts connections but stops answering hangs page renders while `/readyz` stays 200. | P3.S2 |
| TPL-2 | `plugins/_template/dashboard/index.tsx:5-7` | The template's page uses a stock nav section that merchants never see, instead of `registerShellPage`. | P2.S1 (first real feature page) |
| SHELL-2 | `plugins/merchant-shell/tests/tree.test.ts:6-16,113-117` | The D81 test compares against 9 hand-listed stock routes by equality; the dashboard has 25 route groups and the stated risk is a prefix. | M.S1 |
| SHELL-3 | `packages/shared/scripts/i18n/scan-message-ids.ts:36-49`, `check-catalogues.ts:78-87` | `i18n:check` misses a non-dotted id that is not the direct argument of the call, a whitespace-only translation and a flattened Arabic plural. | P2.S1 |
| SHELL-4 | `packages/config/gates/dashboard-styles.ts:19-75` | The style gate lets through `float-left`, `rounded-l`, `border-l`, `space-x-2`, palette classes, named colours, `oklch`, and inline `style` objects. | P2.S1 |
| PKG-7 | `packages/config/gates/tenant-sql.ts:16,38-43` | The session-SQL gate misses a statement after a comment, temp tables, `PREPARE`, `WITH HOLD`, and any file under a nested `dashboard` or `tests` folder. | P1.S6 |
| PKG-8 | `docs/adr/0003-ids.md` (Risks) | The lint against `Number()` and `parseInt()` on ids, and the shared `Id` schema, do not exist. | P3.S4 (first snowflake arithmetic risk) |
| PKG-9 | `packages/config/eslint/index.mjs:8,159-168` | Nothing restricts `eslint-disable` for the architecture rules; `.mjs`, `.js` and `.cts` files get no size rules. | M.S1 |
| PKG-10 | 29 places outside tests | `as unknown as` sidesteps the no-`any` rule. | M.S1 |
| PKG-11 | `packages/shared/src/features/require-feature.ts:22-43`, `rules.ts:93-98` | `requireFeature` fails open until a gate registers; `shared-is-pure` does not ban `node:` imports. | P9.S1 |
| CI-2 | `.github/workflows/browser.yml:5-10` | Browser and storefront smoke tests never gate a PR and nothing reacts when they fail on `main`. Deliberate (ADR 0001 §6); 17 of 17 runs on `main` are green. | M.S1 |
| EV-1, EV-2 | `scripts/evidence/P0.S2b-6.sh`, `scripts/evidence/P0.S2c-polish.sh` | Neither script can run on `main` any more; the first is admitted in the P1.S1 handoff, the second is not. Their evidence is superseded by `docs/evidence/P1.S1`. | M.S1 (mark superseded or delete) |
| EV-3 | `docs/evidence/P1.S2/screens`, `docs/evidence/P1.S3/screens` | 25 screens exist in one viewport or one language only, with no deviation note. | P1.S4 |
| SRV-5, RL-4 | `apps/server/src/config/vendure-config.ts:10,28`, `env.ts:165` | `trustProxy` is a constant 1 and `CLIENT_IP_HEADER` is required in production only, not staging. | P3.S5 (needs its brief to allow the source edit) |
| P3.S5 brief | `docs/roadmap/P3-storefront-checkout.md:323` | Six handoffs assign source changes to P3.S5, whose brief says it edits no plugin or app source: `/readyz` redaction, `trustProxy`, template gating, storefront cache safeguards, `/api/readyz`, `Referrer-Policy`. | Roadmap PR `docs/roadmap-audit-owners` |
| TEN-13 | `plugins/tenancy/api/store.resolver.ts:150-157`, `plugins/rbac/domain/engine-grants.ts:4-10` | Found while fixing H6: `archiveStore` needs `DeleteTenantStore`, which no catalogue key maps to, so only an Owner can archive a store and no role can be granted it. `CreateTenantBusiness` and `DeleteTenantBusiness` guard no handler. The new server test pins the three names in a pending list. **`archiveStore` resolved 2026-11-11 (D97):** catalogue key `store.stores.archive` maps to `DeleteTenantStore`, held by Owner alone among the built-ins and grantable through a custom role; the pending list keeps the other two names. | Resolved for `archiveStore` (D97). `CreateTenantBusiness` and `DeleteTenantBusiness`: user decision, then P1.S4 |
| FLAKY-1 | `plugins/rbac/tests/integration/converge.int.test.ts:136`, `plugins/auth/tests/integration/shop-password-reset-guard.int.test.ts` | Two integration tests failed once each in CI on unrelated PRs (#103, #104) and passed on re-run. The second is fixed in #104 (it now waits for the event); the first is open. The first asserts that no session delete happens, and races the delayed second delete of an earlier test (D55, 500 ms); the second expects one captured mail and found none. | P1.S4 (auth and rbac are its prerequisites) |
| M3 | `scripts/evidence/template-screens.mjs:16-17`, `dashboard-screens.mjs:17`, `P1.S5-screens.mjs:23` | Evidence scripts import plugin dashboard constants by relative path; `scripts/` is outside the new entry-point gate. Found in the review of the M1 fix. | M.S1 |

## Low findings (follow-ups)

| ID | Where | Finding | Owner |
|---|---|---|---|
| RL-1 | `plugins/auth/infrastructure/throttled-native-authentication.strategy.ts:45-91` | The pair lockout is check-then-act: a 60-wide burst gets 60 password checks, not 10. A paced guesser already gets 600 per hour, so the gain is small. | P1.S4 |
| RL-2, RL-5 | `plugins/rate-limit/infrastructure/valkey-rate-limiter.ts:135-181`, `limiter-scripts.ts:11-35` | One Valkey error drops lockouts for 2 s per process; the bucket clock is the api's, not Valkey's. | P1.S6 |
| RL-7 | `plugins/rate-limit/tests` | No test for aliased GraphQL fields in one request, or for `RateLimitedFilter` alone. | P1.S6 |
| AUTH-1 | `plugins/auth/api/account-guard.resolver.ts:40` | The stock profile mutation accepts an empty first name, after which every account email fails to send. The owner can repair it while signed in. | P1.S4 |
| AUTH-4 to AUTH-10 | `plugins/auth` | Provider links survive a soft delete; the OAuth binding cookie lacks the `__Host-` prefix; a password reset sends no notice; Shop customer branches are unthrottled; Turnstile does not check hostname; OTP verify is not atomic; one registry fixture has the wrong body. | P1.S4, except Turnstile and Shop (P3.S4) |
| TEN-4 | `plugins/tenancy/application/update-store.service.ts:38-46` | `defaultCarrierId` and `defaultDeliveryFeeGroupId` accept any id; neither owning brief states the ownership check. | P3.S1, P5.S1 |
| TEN-5 | `plugins/tenancy/infrastructure/owner-role-permissions.ts:8-15` | Owner permissions are a deny-list of three names. | P10.S2 |
| TEN-7 | `plugins/tenancy/infrastructure/valkey-snowflake.generator.ts:115,157` | The worker-id lease expiry is computed after the Valkey reply. | P1.S6 |
| TEN-8 to TEN-12 | `plugins/tenancy` | Stale P1.S1 availability transcript; four isolation rows with no assertion; host cache value parsed with no shape check and keys not namespaced by environment; the `custom_domain` stub has no index. | P1.S6, except `custom_domain` (P8.S9) |
| RBAC-4 to RBAC-9 | `plugins/rbac` | Roles bound only to an archived store skip reach checks (latent); one evidence section is vacuous; `sanitizeDiff` is narrower than D66; the D59 test covers stock permissions only; `templateOf` was never built; French labels have no owner. | P1.S4, except labels (copy pass) |
| HEALTH-2 to HEALTH-5 | `plugins/platform-health` | Failed Postgres and migration probes are never logged; `/livez` reports the worst lag since the last caller; the eviction policy is checked once; a probe timeout does not cancel its query. | P1.S6 |
| TPL-3 to TPL-7 | `plugins/_template`, `apps/server/src/config/plugins.config.ts:108` | The demo plugin ships in every environment; its README contradicts the code; one isolation row has no assertion (a shared `expect.requireAssertions` would catch this class). | P2.S1 |
| SHELL-1, SHELL-5 to SHELL-10 | `plugins/merchant-shell` | No PR-time check that the stock selectors and route ids still exist; component tests replaced by browser tests without a recorded deviation; the P0 placeholder route is still registered; the foreign-store browser test uses a made-up id; Create Store can be re-submitted after a timeout; `/settings` has no logo though the inventory row is ticked; one import of a dashboard internal. | M.S1 and P2.S1 |
| SF-3, SF-5 to SF-8 | `apps/storefront` | No negative cache for unknown hosts; stale P0.S2b-5 evidence; cross-tenant smoke runs only after merge; tag sets never shrink; `/readyz` returns raw error text. | P3.S2 |
| SRV-6 to SRV-15 | `apps/server` | No test that asset paths stay inside the `assets/` prefix (safe today); no `down` migration is ever run by a test; secret checks are by marker only; `PLATFORM_DOMAIN=platform.invalid` boots in production; staging keeps introspection; the cookie `Secure` flag is implicit; `migrate` runs the scheduler; the migrate lock has no timeout. | P1.S6 and P3.S5 |
| CI-3 to CI-7 | `.github/workflows/attribution.yml:21`, `.githooks/commit-msg:5` | One unpinned action and a job with no timeout; the attribution pattern has bypass spellings and ignores the author field; a gate-only re-run can never go green; no `dependabot.yml`; `ci-duration.sh` is never run. | M.S1 |
| PKG-12 to PKG-15 | `packages/shared`, `packages/testing` | Snowflake clock-range guard; `createTwoBusinesses` never asserts the two are distinct; smaller gate gaps. | M.S1 |

## Carry-overs nobody owned

Handoff items for which no brief named an owner. Each now has one in the tables above or here.

| Item | From | Owner now |
|---|---|---|
| SMTP credentials and required TLS | P1.S2 | Resolved 2026-11-11 (SRV-1, D96) |
| Turnstile on sign-up, and the ADR 0008 against ADR 0012 conflict | P1.S2 | P3.S4, as a user decision |
| First run against real Google and Facebook | P1.S2 | user, when credentials exist |
| French emails and labels; native review of Arabic copy | P1.S2, P1.S3, P1.S5 | user decision: a copy pass session |
| Business suspension must invalidate hosts; no session writes suspension at all | P1.S1 | P10.S2 |
| Release job for archived subdomains (D4) | P1.S1 | P8.S9 |
| Store profile settings UI and business logo on `/settings` | P1.S5 | P2.S1 or a P1 polish session, user decision |
| HardenPlugin query complexity against real list pages | P0.S2b-4 → P1.S5, dropped | P4.S1 (first list page) |
| Defence-in-depth check that the `/_t/[storeId]` page matches the request host | P0.S2b-5 → P1.S1, dropped | P3.S2 |
| `tenantKey` helper for cache and object keys (ADR 0002 §5) | P1.S1 | P2.S1 (first tenant assets) |
| Cross-process session flush proven only by the evidence script | P1.S3 | P1.S4 |
| Four synthetic members left in the user's local database | P1.S5 | user |

## Checked and found clean

- **Tenant isolation.** Every tenant table (`business`, `store`, `custom_domain`, `business_order_sequence`, `business_role`, `role_binding`, `member_role_assignment`, `activity_log`, `template_note`) is reached only through `TenantRepository` or `tenantQuery`. Every client-supplied id is checked against the caller's business. A two-business test exists for every entity and for every GraphQL operation and REST route of tenancy (14), rbac (19) and the template, enforced by registries compared with runtime metadata. `switchableStores` returns only the caller's active, reachable stores and no channel token.
- **Auth.** Tokens are single-use by a conditional update and stored as HMACs; comparisons are constant-time; `account_token` is read only by HMAC or by the session's own user id; reset voids tokens and sessions; logout ends one session; the eight shadowed stock mutations cannot be reached by another name; OAuth state is sealed, bound to the browser and uses PKCE; email templates escape every value.
- **Rate limits.** Every policy value matches D29, D44 and D51; the Lua bucket is atomic; keys are HMACs or canonical IPs, never raw input; every handler the decisions name carries its policy on both REST and GraphQL.
- **Privilege escalation.** All eight D60 rules are enforced in `application` from database rows under the D70 lock, on every path including duplicate and start-from; REST and GraphQL share the services.
- **Dashboard.** Everything the shell hides on the client is refused by the server. No `dangerouslySetInnerHTML`, no URL-derived redirect, nothing written to local storage, no business rule in the frontend, no third-party name on a merchant surface.
- **Storefront.** No way was found to serve one store's content under another store's host: only `Host` is read, the store id travels as a route parameter, direct `/_t/…` access is blocked in every encoding, and cache keys include the store.
- **Migrations.** All seven have a `down` that reverses `up`; none uses session `SET`, session advisory locks, `LISTEN` or `CONCURRENTLY`; `migrate` uses the direct connection; api and worker never migrate at boot; `synchronize` is false in every role; a drift test compares entities and custom fields with the migrated schema.
- **Pooling.** Every advisory lock is `pg_advisory_xact_lock` inside an open transaction; `set_config` is transaction-local; the pool-size-1 leak test is real and runs in CI.
- **Secrets and evidence.** No `.env` or real secret is committed; all 186 authorization, session and cookie lines in the transcripts are redacted; data is synthetic; no PNG exceeds 300 KB (largest 122 KB); 0 open Dependabot alerts.
- **CI.** Lint, `test:arch`, `i18n:check`, typecheck, unit, integration (five shards covering every package with a suite) and build all run on every PR behind the required `build-test` check; actions are pinned by SHA except one (CI-3); no secret reaches a workflow.

## Gates on `main` at the audited commit

| Gate | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm test:arch` | pass, 228 tests (outside a `.claude/` path) |
| `pnpm i18n:check` | pass |
| `pnpm typecheck` | pass, 12 tasks |
| Unit tests per plugin | pass, 569 tests in 7 plugins |
| Integration tests per plugin | pass, 766 tests in 6 plugins |

## Not checked

- No evidence script was re-run; EV-2 is from reading. Screenshots were not all opened by eye.
- Real Google and Facebook sign-in, a real SMTP relay and a real Cloudflare edge: all mocked, as the project rules require.
- The findings marked suspected and not reproduced: SF-4 was confirmed from library source but no Valkey was stalled; AUTH-4, TPL-5 (NUL in a title) and SHELL-8 were not executed.
- Arabic wording quality.
- The bodies of roughly 8 000 lines of auth integration tests were read by title and by pattern, not line by line; a test that cannot fail could remain there.
- The 89-table init migration's `down` was checked by statement counts, not line by line. No test runs a `down` (SRV-7).
- Secret scanning is disabled on the repository, so only GitGuardian's PR check was seen.
- Load behaviour (SF-3, HEALTH-1 flood) was reasoned, not measured.

## Fix status

One small PR per module, each with a failing test first and a review by a second agent.

| Finding | Branch | PR | State |
| --- | --- | --- | --- |
| H1, CI-3 | `fix/audit-ci` | #100 | merged |
| H2, H3, H4, H5 | `fix/audit-config` | #102 | merged |
| M2 | `fix/audit-tenancy` | #103 | merged |
| M1 | `fix/audit-server` | #104 | merged |
| H6 | `fix/audit-template` | #105 | merged |
| Browser run on `main` (one store-switcher test timing out on slow runners) | `fix/audit-browser` | #106 | merged |
