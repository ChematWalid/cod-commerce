# `plugins/catalog`: products, variants and the media library

The store catalog of P2.S1: products and variants on Vendure's own `Product` / `ProductVariant` with our custom
fields, brands, tags, highlights, product settings and a per-business media library in tenant tables beside them
(D2100). The layout and layer rules are those of `plugins/_template` (see its README).

## Public entry (D2104)

`index.ts` is the only file another workspace package may import, as `@cod/plugin-catalog`:

- other plugins import it only from `infrastructure/`, from their root `*.plugin.ts` module file and from their
  `tests/` (test kits list `CatalogPlugin`, D2137), per rule `catalog-entry-infra-only` in
  `packages/config/architecture/rules.ts`; their `api/`, `application/`, `domain/` and `dashboard/` reach the
  catalog through their own ports or the API;
- of the apps only `apps/server` imports it (it registers `CatalogPlugin` and runs the demo seed); frontend apps such
  as `apps/storefront` are API clients and are refused (ADR 0017);
- shared contracts (types, event names, zod schemas, constants, page and block ids) live in
  `packages/shared/src/catalog/`, not here.

The entry exports only `CatalogPlugin` for now; later tasks add the services that P2.S2-S5 and P3 consume, and the
session handoff lists them.

## Registration (D2137)

`apps/server/src/config/plugins.config.ts` registers `CatalogPlugin` once, inside `memberPlugins`, after
`AuthPlugin` and before `TeamPlugin`: Team imports the catalog module to register its order-manager check.

## Tests

- `pnpm --filter @cod/plugin-catalog test`: unit tests (domain, use cases with fakes, contracts).
- `pnpm --filter @cod/plugin-catalog test:integration`: a Vendure test server on the compose Postgres; CI runs it
  in its own matrix part `catalog` (D2116).
