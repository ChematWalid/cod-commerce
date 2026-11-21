import { CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { catalogImportOf } from './catalog-import-world';
import { catalogOf, restIdOf } from './catalog-world';
import type { Expectation } from './matrix';
import type { BusinessWorld } from './world-types';

/** The rows of a business the catalog-import cells aim at, and the refusals they expect (P2.S2). */

export const JOB_NOT_FOUND = CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND;
export const PRODUCT_NOT_FOUND = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
const NOT_FOUND = 404;

/** A GraphQL refusal of another store's or business's job: not found (D2136). */
export const jobNotFound: Expectation = { kind: 'code', code: JOB_NOT_FOUND };
/** A REST refusal with `code`: 404. */
export const restNotFound = (code: string): Expectation => ({ kind: 'status', status: NOT_FOUND, code });

/** The rows of a business a call names; product ids in the GraphQL or the REST spelling. */
export interface ImportTarget {
  /** The catalog product (bulk edit, export). */
  readonly productId: string;
  readonly importId: string;
  readonly exportId: string;
  readonly linkImportId: string;
  /** The Draft the link import made, with its origin row (polish). */
  readonly linkProductId: string;
}

/** `business`'s rows as GraphQL names them. */
export function importTargetOf(business: BusinessWorld): ImportTarget {
  const rows = catalogImportOf(business);
  return {
    productId: catalogOf(business).product.id,
    importId: rows.spreadsheet.importId,
    exportId: rows.exportId,
    linkImportId: rows.link.importId,
    linkProductId: rows.link.productId,
  };
}

/** `business`'s rows as the REST routes name them. */
export const restImportTargetOf = (business: BusinessWorld): ImportTarget => {
  const target = importTargetOf(business);
  return { ...target, productId: restIdOf(target.productId), linkProductId: restIdOf(target.linkProductId) };
};
