# `plugins/_template`: the reference plugin

A tenant-scoped "notes" feature that shows every rule of CLAUDE.md §3a in working code: every layer, a port
with two adapters, tenant filtering, typed errors with one error mapping, a dashboard page, and every test
kind. It is registered on every role and its `templateNotes` query and dashboard page (`/dashboard/template-notes`)
are live, so it stays honest: the full gate runs it.

## Layout and layer rules

| Folder            | Holds                                                         | May import                                  |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `domain/`         | entities, value objects, typed errors, ports, `constants.ts`  | `domain/`, `@cod/shared` (no Nest, Vendure, TypeORM, not even types) |
| `application/`    | use cases (plain classes), application ports, DI tokens       | `application/`, `domain/`, `@cod/shared` (no Nest, Vendure, TypeORM, not even types) |
| `infrastructure/` | adapters: TypeORM entity and repository, scope resolver, ids  | `infrastructure/`, `application/`, `domain/` |
| `api/`            | GraphQL schema, resolver, DTOs, permissions, error mapping    | `api/`, `application/`, `domain/`            |
| `dashboard/`      | the dashboard extension (ADR 0010)                            | `dashboard/`, `domain/`                      |
| `tests/`          | unit, contract, integration tests and fakes                   | anything in the plugin                       |
| root              | `index.ts` (public entry), `*.plugin.ts` (wiring), `*.config.ts` | anything in the plugin                    |

ESLint (`boundaries/*`, `no-restricted-imports`, size limits) and the dependency-cruiser architecture test
enforce the table; a file outside these places fails `boundaries/no-unknown-files`. Another plugin's files
are never imported: share through `@cod/shared` contracts or domain events.

## How the pieces fit

- `TemplateNoteResolver` resolves the caller's `TenantScope` through `TenantScopeResolver`, runs a use case,
  and maps a `DomainError` to `DomainInputError` (`api/error-mapping.ts`, the plugin's only error mapping).
  The client sees the domain error's stable `code` in `extensions.code`.
- `CreateNoteService` and `GetNotesService` depend on ports only (`NoteRepositoryPort`, `IdGeneratorPort`)
  and a clock, so they are unit-tested with fakes. `template.plugin.ts` builds them with `useFactory`.
- `TypeOrmNoteRepository` filters every query by `scope.businessId` and joins the request's transaction
  through `RequestTenantScope`. `InMemoryNoteRepository` (tests) passes the same contract.
- The dashboard page reads through `useQuery`: switching the channel invalidates every query, so it refetches for
  the new business and shows the loading state meanwhile. A one-shot `useEffect` would keep the old business's notes.
- The GraphQL input never has a `businessId`; the business comes from the request, never from the client.
- Note ids are `String!` in GraphQL, not `ID!`: Vendure decodes `ID` arguments with the entity id strategy,
  and the default one would turn a 63-bit id into a lossy JavaScript number.

## How to add a feature

1. **Copy** this folder to `plugins/<name>/`, without `node_modules/`, `dist/` and `.turbo/`, and rename:
   - the package (`@cod/plugin-<name>`) and its description;
   - the plugin class and `template.plugin.ts`, also in `tsconfig.build.json`'s `include`;
   - the entity and its table, the permission, and the GraphQL types and fields;
   - the error codes (`domain/errors.ts`) and the DI token strings (`application/tokens.ts`);
   - the dashboard constants and nav item (`dashboard/constants.ts`: path, test id, nav id and title, permission),
     the page and block ids in the route file, and the query key;
   - the `index.ts` exports.
2. **Register** it: add `"@cod/plugin-<name>": "workspace:*"` to `apps/server/package.json`, run `pnpm install`,
   and add one line in `buildPlugins` (`apps/server/src/config/plugins.config.ts`). A plugin with entities goes
   on every role, so `migrate` creates its tables. Add a line for it to
   `apps/server/tests/unit/plugins-registered.test.ts`.
   - The **dashboard** extension needs no registration: `build:dashboard` picks up the `dashboard` entry of every
     plugin that `buildPlugins` returns for the api role. Re-run `pnpm --filter @cod/server build:dashboard` to see
     a change on the api's `/dashboard`.
   - The **permission** is registered by the plugin's `configuration` function, and nobody but the superadmin has
     it until it is granted to a role.
3. **Migrate**: `pnpm --filter @cod/server migration:generate <name>` against the migrated dev database. The
   generator already makes the `typeorm` import type-only and the methods `Promise<void>`, so the file needs no
   hand edit; review it: `bigint` primary key, `businessId bigint NOT NULL` with an index. The RF4 e2e
   (`migrate-seed.e2e.test.ts`) fails while the entities and the committed migrations differ.
4. **Follow the layer rules** in the table above.
5. **Checklist** before the PR:
   - [ ] domain unit tests, without Nest or the database (`tests/unit/`);
   - [ ] a use-case test with the in-memory fake;
   - [ ] a contract test per adapter of each port (`tests/contract/`), run by every adapter;
   - [ ] an integration test per endpoint (`createPluginTestEnvironment` from `@cod/testing`);
   - [ ] a `FORBIDDEN` test for every handler, mutations included, with a role lacking its permission: Vendure
     lets anyone call a handler that has no `@Allow`;
   - [ ] a two-business isolation test per entity and endpoint, including the unknown-channel-token case;
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

- **P1.S1** replaces the three stubs (dated deviations 6 and 7):
  - `ChannelTenantScopeResolver` (one channel = one business) becomes the ADR 0002 `TenantContextResolver`,
    which derives the business from the authenticated administrator;
  - the entity's own `businessId` column moves to the `TenantEntity` base class, and the repository goes
    through `TenantRepository` / `tenantQuery`;
  - `RandomBigintIdGenerator` becomes the ADR 0003 snowflake generator, behind the same `IdGeneratorPort`
    (P1.S1 owns ids).
- **P1.S5** adds the dashboard's `.po` catalogues; until then the page's strings are English only.
