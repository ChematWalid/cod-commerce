# `plugins/offers`: pricing and offer engine

The pricing engine of a store (P2.S4, ADR 0004): it turns a cart into a quote (lines, discounts, applied and
skipped offers with reasons, rejected codes, nudge, suggestions, delivery block, totals and a signed `qt1` token)
for the quantity, free-delivery, product-discount and order-discount kinds, plus discount codes. There is no HTTP
endpoint in P2.S4: the storefront quote route arrives in P3.S3 and the merchant offer editor in P2.S5.

## Layout

The plugin follows `plugins/_template` (CLAUDE.md §3a.1):

| Folder            | Holds                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| `domain/`         | the pure engine (`domain/engine/*`), one adapter per offer kind (`domain/kinds/*`), ports |
| `application/`    | `PricingService`, `OfferAdminService` and the registrar seams                           |
| `infrastructure/` | TypeORM entities and repositories, the variant gate, Vendure adapters                   |
| `tests/`          | unit tests (no DB), contract tests and integration tests                                |

## Public entry and dependency rules (D2402)

- `index.ts` is the only file other code imports. Outside the plugin, only an adapter (`infrastructure/`), a root
  `*.plugin.ts` module file, a test kit or `apps/server` may import it (`offers-entry-infra-only`).
- The offers depend on the catalog (from `infrastructure/` and `offers.plugin.ts` only); the catalog never imports
  the offers (`catalog-no-offers`).
- `buildPlugins` registers `OffersPlugin` on every role, right after `CatalogPlugin`.

## Commands

```bash
pnpm --filter @cod/plugin-offers test              # unit tests
pnpm --filter @cod/plugin-offers test:coverage     # unit tests with the domain/ line-coverage gate (D2430)
pnpm --filter @cod/plugin-offers test:integration  # Vendure test server on the compose Postgres
pnpm --filter @cod/plugin-offers typecheck
```
