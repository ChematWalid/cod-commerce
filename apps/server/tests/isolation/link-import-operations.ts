import { LINK_FIXTURE_URL } from './catalog-import-world';
import type { SweptOperation, SweptRoute } from './endpoint-sweep';
import { type ImportTarget, JOB_NOT_FOUND, jobNotFound, PRODUCT_NOT_FOUND, restNotFound } from './import-targets';

/**
 * The link import and polish endpoints (plugins/catalog-import, P2.S2, D2214, D2215) as the P2 matrix calls them,
 * aimed at a business's link import job and the Draft it made; part of the import endpoint lists.
 */

const LINK_FIELDS = 'importId status productId';
const linkBody = (): Record<string, unknown> => ({ url: LINK_FIXTURE_URL });

export const LINK_OPERATIONS: readonly SweptOperation<ImportTarget>[] = [
  {
    name: 'createCatalogLinkImport',
    entity: 'product origin',
    document: `mutation ($input: CatalogLinkImportInput!) { createCatalogLinkImport(input: $input) { ${LINK_FIELDS} } }`,
    variables: () => ({ input: linkBody() }),
  },
  {
    name: 'catalogLinkImport',
    entity: 'import job',
    document: `query ($id: String!) { catalogLinkImport(id: $id) { ${LINK_FIELDS} } }`,
    variables: (t) => ({ id: t.linkImportId }),
    foreign: jobNotFound,
  },
  {
    name: 'polishCatalogProduct',
    entity: 'product origin',
    document: 'mutation ($id: ID!) { polishCatalogProduct(id: $id) { productId title } }',
    variables: (t) => ({ id: t.linkProductId }),
    foreign: { kind: 'code', code: PRODUCT_NOT_FOUND },
  },
];

export const LINK_ROUTES: readonly SweptRoute<ImportTarget>[] = [
  {
    method: 'POST',
    route: '/catalog/scrape/import-job',
    entity: 'product origin',
    path: () => '/catalog/scrape/import-job',
    body: linkBody,
  },
  {
    method: 'GET',
    route: '/catalog/scrape/import-jobs/:id',
    entity: 'import job',
    path: (t) => `/catalog/scrape/import-jobs/${t.linkImportId}`,
    foreign: restNotFound(JOB_NOT_FOUND),
  },
  {
    method: 'POST',
    route: '/catalog/scrape/products/:id/polish',
    entity: 'product origin',
    path: (t) => `/catalog/scrape/products/${t.linkProductId}/polish`,
    foreign: restNotFound(PRODUCT_NOT_FOUND),
  },
];
