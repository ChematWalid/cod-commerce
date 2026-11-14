# `plugins/_template`: the reference plugin

A tenant-scoped "notes" feature that shows every rule of CLAUDE.md §3a in working code: every layer, a port
with two adapters, tenant filtering, typed errors with one error mapping, a dashboard page component, and every
test kind. It is a development aid: `buildPlugins` registers it on every role only when `APP_ENV` is `development`
or `test`, never on staging or production (D2111, #170). There its `templateNotes` query is live, so it stays
honest: the full gate runs it. Its dashboard page has no route and no nav item: merchants never see a stock
section (#122). A merchant page is registered in the shell with `registerShellPage` from
`@cod/plugin-merchant-shell/shell-api`; the live example is
`plugins/merchant-shell/dashboard/index.tsx` (`registerShellPage('settings.general', ...)`).

## Layout and layer rules

| Folder            | Holds                                                         | May import                                  |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `domain/`         | entities, value objects, typed errors, ports, `constants.ts`  | `domain/`, `@cod/shared` (no Nest, Vendure, TypeORM, not even types) |
| `application/`    | use cases (plain classes), application ports, DI tokens       | `application/`, `domain/`, `@cod/shared` (no Nest, Vendure, TypeORM, not even types) |
| `infrastructure/` | adapters: TypeORM entity and repository, ids                  | `infrastructure/`, `application/`, `domain/` |
| `api/`            | GraphQL schema, resolver, DTOs, permissions, error mapping    | `api/`, `application/`, `domain/`, `@cod/plugin-rbac/guard` |
| `dashboard/`      | the dashboard extension (ADR 0010)                            | `dashboard/` only (ADR 0017, D92), `@cod/plugin-merchant-shell/shell-api` |
| `tests/`          | unit, contract, integration tests and fakes                   | anything in the plugin                       |
| root              | `index.ts` (public entry), `*.plugin.ts` (wiring), `*.config.ts` | anything in the plugin                    |

ESLint (`boundaries/*`, `no-restricted-imports`, size limits) and the dependency-cruiser architecture test
enforce the table; a file outside these places fails `boundaries/no-unknown-files`. Another plugin's files
are never imported: share through `@cod/shared` contracts or domain events. Tenancy is consumed only through the
`@cod/plugin-tenancy` entry point (D10), and rbac only through `@cod/plugin-rbac/guard`, from `api/` (D58).

## How the pieces fit

- Each handler of `TemplateNoteResolver` is guarded by `requirePermission('<catalogue key>')`: it asks for that
  permission on the active store and applies `@TenantScoped()`, whose guard (imported through `TenancyPlugin`, A6)
  derives the tenant from the administrator and the channel. The plugin defines no permission of its own: roles
  are built from catalogue keys alone, so one would reach Owners and nobody else. `RbacPlugin` must be registered
  on the server, which `buildPlugins` does. The resolver builds the scope from `tenantOf(ctx)`, runs a use case,
  and maps a `DomainError` to `DomainInputError` (`api/error-mapping.ts`, the plugin's only error mapping).
  The client sees the domain error's stable `code` in `extensions.code`.
- `CreateNoteService` and `GetNotesService` depend on ports only (`NoteRepositoryPort`, `IdGeneratorPort`)
  and a clock, so they are unit-tested with fakes. `template.plugin.ts` builds them with `useFactory`.
- `TypeOrmNoteRepository` goes through `TenantRepository` (ADR 0002), which confines every call to
  `scope.businessId` and joins the request's transaction through `RequestTenantScope`. `NoteEntity` extends
  `TenantEntity`. `InMemoryNoteRepository` (tests) passes the same contract.
- The dashboard page reads through `useQuery`: switching the channel invalidates every query, so it refetches for
  the new business and shows the loading state meanwhile. A one-shot `useEffect` would keep the old business's notes.
- The GraphQL input never has a `businessId`; the business comes from the request, never from the client.
- Note ids are `String!` in GraphQL, not `ID!`: Vendure decodes `ID` arguments with the entity id strategy,
  and the default one would turn a 63-bit id into a lossy JavaScript number.

## How to add a feature

1. **Copy** this folder to `plugins/<name>/`, without `node_modules/`, `dist/` and `.turbo/`, and rename:
   - the package (`@cod/plugin-<name>`) and its description;
   - the plugin class and `template.plugin.ts`, also in `tsconfig.build.json`'s `include`;
   - the entity and its table, and the GraphQL types and fields;
   - the error codes (`domain/errors.ts`) and the DI token strings (`application/tokens.ts`);
   - the dashboard constants (`dashboard/constants.ts`: test id, title), the page and block ids in the page file,
     and the query key;
   - the `index.ts` exports.
2. **Register** it: add `"@cod/plugin-<name>": "workspace:*"` to `apps/server/package.json`, run `pnpm install`,
   and add one line in `buildPlugins` (`apps/server/src/config/plugins.config.ts`). A plugin with entities goes
   on every role, so `migrate` creates its tables (unlike this template, a feature plugin is registered in every
   `APP_ENV`). Add a line for it to `apps/server/tests/unit/plugins-registered.test.ts`.
   - The **dashboard** extension needs no registration: `build:dashboard` picks up the `dashboard` entry of every
     plugin that `buildPlugins` returns for the api role. A merchant page fills a shell leaf with
     `registerShellPage` (see `plugins/merchant-shell/dashboard/index.tsx`); never add a `navMenuItem` or a `navSections`
     entry in a stock section (`BUILT_IN_NAV_SECTION_IDS`: `insights`, `catalog`, `sales`, `customers`, `marketing`,
     `system`, `settings`), and name a section with a literal or a `const` of your own plugin:
     `packages/config/tests/dashboard-nav-items.test.ts` fails otherwise. Re-run `pnpm --filter @cod/server build:dashboard` to see a change on the api's `/dashboard`.
   - **Permissions**: pick the catalogue keys of your area, or add them in
     `packages/shared/src/permissions/catalog/` (its tests pin the counts, D61), and name them in
     `api/permissions.ts`. Guard every handler with `requirePermission(key)` from `@cod/plugin-rbac/guard`.
     Do not define a `PermissionDefinition`: `plugin-permissions-grantable.test.ts` fails one no role can be
     granted. An Owner holds every key; the platform superadmin has no tenant and is refused.
3. **Migrate**: `pnpm --filter @cod/server migration:generate <name>` against the migrated dev database. The
   generator already makes the `typeorm` import type-only and the methods `Promise<void>`, so the file needs no
   hand edit; review it: `bigint` primary key, `businessId bigint NOT NULL` with an index (from `TenantEntity`),
   and a composite `(businessId, createdAt, id)` index when the entity is listed newest first. The RF4 e2e
   (`migrate-seed.e2e.test.ts`) fails while the entities and the committed migrations differ.
4. **Follow the layer rules** in the table above.
5. **Checklist** before the PR:
   - [ ] domain unit tests, without Nest or the database (`tests/unit/`);
   - [ ] a use-case test with the in-memory fake;
   - [ ] a contract test per adapter of each port (`tests/contract/`), run by every adapter;
   - [ ] an integration test per endpoint (`createPluginTestEnvironment` and `createTwoBusinesses` from `@cod/testing`);
   - [ ] a test that a member holding the key through a non-owner business role can call the handler; grant in
     tests through a business role (`tests/integration/template-note-members.ts`), never a raw Vendure role;
   - [ ] `RbacPlugin` imported in the `*.int.test.ts` file itself, with `testRateLimitPlugin()` and tenancy in its
     plugin list: a non-test helper under `tests/` that imports `@cod/plugin-rbac` fails the architecture rule;
   - [ ] a `FORBIDDEN` test for every handler, mutations included, with a business role lacking its permission:
     Vendure lets anyone call a handler that has no guard;
   - [ ] a two-business isolation test per entity and endpoint, from a registry checked against the plugin's
     `adminApiSchema` (`adminOperationsOf`), including B's channel token and the unknown-channel-token case;
   - [ ] typed `DomainError`s with stable codes, mapped through `DomainInputError` only;
   - [ ] constants in `domain/constants.ts`, never inline;
   - [ ] `requireFeature(feature, scope)` (`@cod/shared`) where the feature is gated;
   - [ ] TSDoc on public functions and endpoints;
   - [ ] new dashboard pages appended to `apps/server/tests/browser/dashboard-pages.ts` (RTL check);
   - [ ] the full gate green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
     `pnpm run test:arch`, `pnpm build`, `pnpm --filter @cod/server build:dashboard`, and, with the api running,
     `pnpm --filter @cod/server test:browser`.

Tests run with `pnpm --filter @cod/plugin-<name> test` (unit) and `test:integration` (needs the compose
Postgres; `DATABASE_URL_DIRECT` comes from `apps/server/.env` or the environment).

## What changes later

- The dashboard's strings are in `dashboard/i18n/*.po` (Arabic and English).
- The P1 isolation e2e and `scripts/evidence/P1-isolation.sh` reach the template note row only on a server whose
  `APP_ENV` is `test` or `development`.
