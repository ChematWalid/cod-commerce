/** The link import and polish handlers of the endpoint registry (Task 10, D2214, D2215). */
import { CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { rawTestId } from '@cod/testing';
import { LINK_FIXTURE_URLS } from '../../infrastructure/link-fixtures';
import type { OperationEntry, RouteEntry } from './endpoint-types';

const CREATE = 'catalog.products.create';
const EDIT = 'catalog.products.edit';
const JOB_NOT_FOUND = CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND;
const PRODUCT_NOT_FOUND = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;

/** A link import (D2214) of the fixture scraper's synthetic page. */
export const linkImportBody = (): Readonly<Record<string, unknown>> => ({ url: LINK_FIXTURE_URLS.kaftan });

/** The selection of a link import answer. */
export const LINK_IMPORT_FIELDS = 'importId status sourceUrl productId';

/** The selection of a polish answer (D2215). */
export const POLISH_FIELDS = 'productId title description';

/** The link import and polish operations. */
export const LINK_OPERATIONS: readonly OperationEntry[] = [
  {
    operation: 'createCatalogLinkImport',
    access: CREATE,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    document: `mutation ($input: CatalogLinkImportInput!) { createCatalogLinkImport(input: $input) { ${LINK_IMPORT_FIELDS} } }`,
    variables: () => ({ input: linkImportBody() }),
  },
  {
    operation: 'catalogLinkImport',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `query ($id: String!) { catalogLinkImport(id: $id) { ${LINK_IMPORT_FIELDS} } }`,
    variables: (ids) => ({ id: ids.linkImportId }),
  },
  {
    operation: 'polishCatalogProduct',
    access: EDIT,
    foreign: 'not-found',
    notFound: PRODUCT_NOT_FOUND,
    document: `mutation ($id: ID!) { polishCatalogProduct(id: $id) { ${POLISH_FIELDS} } }`,
    variables: (ids) => ({ id: ids.productId }),
  },
];

/** The link import and polish REST routes. */
export const LINK_ROUTES: readonly RouteEntry[] = [
  {
    method: 'POST',
    route: '/catalog/scrape/import-job',
    access: CREATE,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    url: () => '/catalog/scrape/import-job',
    body: () => linkImportBody(),
  },
  {
    method: 'GET',
    route: '/catalog/scrape/import-jobs/:id',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: (ids) => `/catalog/scrape/import-jobs/${ids.linkImportId}`,
  },
  {
    method: 'POST',
    route: '/catalog/scrape/products/:id/polish',
    access: EDIT,
    foreign: 'not-found',
    notFound: PRODUCT_NOT_FOUND,
    url: (ids) => `/catalog/scrape/products/${rawTestId(ids.productId)}/polish`,
  },
];
