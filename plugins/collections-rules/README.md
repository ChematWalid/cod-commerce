# `plugins/collections-rules`: store collections with conditions

The store collections of P2.S3. A collection is a Vendure `Collection` in the store channel only (name, description,
slug, featured image) plus our definition row: `manual` (products picked and ordered by hand) or `automatic`
(All/Any conditions on tag, brand, price, on sale, title and every option name of the store), visibility, position
and the ordered membership (D2300-D2303). The layout and layer rules are those of `plugins/_template`.

## Layers

- `domain/`: the rule evaluator (`evaluate-rule.ts`, one matcher per field in `condition-matchers.ts`), the rule
  facts of a product (`product-facts.ts`, hidden variants left out, D2304), membership rows and diffs
  (`membership.ts`), the mode switch (`collection.ts`, D2302) and the typed errors of `COLLECTIONS_ERROR_CODES`.
- Shared contracts (rule schema, inputs, caps, error codes, `normalForMatch`, the `collection.changed` payload) live
  in `packages/shared/src/collections/`.

## Public entry (D2317)

`index.ts` is the only file another workspace package may import, as `@cod/plugin-collections-rules`, and only from
its `infrastructure/`, its root `*.plugin.ts` file and its `tests/` (rule `collections-entry-infra-only` in
`packages/config/architecture/rules.ts`). It exports `CollectionsRulesPlugin`; the read service and the membership
queries join it in later tasks of P2.S3.

## Commands

`pnpm --filter @cod/plugin-collections-rules test` (unit), `typecheck`, and `test:integration` (needs the compose
Postgres).
