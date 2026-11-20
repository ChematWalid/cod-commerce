import { CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { catalogOf } from '../catalog-world';
import { operationRequest, sweepCases } from '../endpoint-sweep';
import { BULK_EDIT_DOCUMENT, IMPORT_ENDPOINTS } from '../import-operations';
import { type IsolationCase, ownChannel, ownerRest } from '../matrix';
import type { BusinessWorld } from '../world-types';

/**
 * The bulk edit, export, import and link import cells (plugins/catalog-import, P2.S2): every endpoint's sweep (B's
 * jobs and products by id, B's store token, a store-restricted member on the store it may not reach), plus bulk
 * edits of A's own product naming B's brand or tag, refused as a whole before anything is written (D2213).
 */
const TAXONOMY_NOT_FOUND = CATALOG_IMPORT_ERROR_CODES.TAXONOMY_NOT_FOUND;
const NOT_FOUND = 404;

/** A's product with B's brand, or B's tag added. */
const FOREIGN_TAXONOMY = [
  { name: 'brand', changes: (b: BusinessWorld) => ({ brandId: catalogOf(b).brand.id }) },
  { name: 'tag', changes: (b: BusinessWorld) => ({ addTagIds: [catalogOf(b).tag.id] }) },
] as const;

const graphqlTaxonomyCases: IsolationCase[] = FOREIGN_TAXONOMY.map(({ name, changes }) => ({
  id: `import.bulkEditCatalogProducts.foreign-${name}`,
  entity: 'product',
  endpoint: 'bulkEditCatalogProducts',
  access: 'write',
  title: `A's owner bulk edits A's product with B's ${name}: taxonomy-not-found, nothing written`,
  request: (a, b) =>
    operationRequest(
      BULK_EDIT_DOCUMENT,
      { input: { productIds: [catalogOf(a).product.id], changes: changes(b) } },
      { caller: a.owner, channel: ownChannel(a) },
    ),
  expect: { kind: 'code', code: TAXONOMY_NOT_FOUND },
  reverse: true,
}));

const restTaxonomyCases: IsolationCase[] = FOREIGN_TAXONOMY.map(({ name, changes }) => ({
  id: `import.post-/catalog/products/bulk-edit.foreign-${name}`,
  entity: 'product',
  endpoint: 'POST /catalog/products/bulk-edit',
  access: 'write',
  title: `A's owner bulk edits A's product with B's ${name} over REST: ${String(NOT_FOUND)}, nothing written`,
  request: (a, b) =>
    ownerRest(a, 'POST', '/catalog/products/bulk-edit', {
      productIds: [catalogOf(a).product.restId],
      changes: changes(b),
    }),
  expect: { kind: 'status', status: NOT_FOUND, code: TAXONOMY_NOT_FOUND },
  reverse: true,
}));

export const IMPORT_EXPORT_CASES: readonly IsolationCase[] = [
  ...sweepCases(IMPORT_ENDPOINTS),
  ...graphqlTaxonomyCases,
  ...restTaxonomyCases,
];
