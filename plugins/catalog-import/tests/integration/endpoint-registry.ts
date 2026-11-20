/**
 * The registry of every catalog-import handler: its operation or route, permission, a call aimed at a target's ids,
 * and what another business gets back. The coverage test, the isolation sweep and the permission suite read it.
 * Each task appends its handlers here (bulk edit from Task 7).
 */
import { CATALOG_ERROR_CODES, type PermissionKey } from '@cod/shared';
import { rawTestId } from '@cod/testing';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  /** An import job of the business's first store. */
  readonly importId: string;
  /** An export job of the business's first store. */
  readonly exportId: string;
  /** A product of the business's first store. */
  readonly productId: string;
}

/**
 * `null` (a read of none), `not-found` (the entry's not-found code, 404 over REST) or `reported` (the call succeeds
 * and reports each named product with the entry's not-found code, D2213).
 */
export type ForeignOutcome = 'null' | 'not-found' | 'reported';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  readonly notFound: string;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly route: string;
  readonly access: PermissionKey;
  readonly foreign: Exclude<ForeignOutcome, 'null'>;
  readonly notFound: string;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** A bulk edit (D2213) setting the target's product to Draft; REST names the database id, GraphQL its `ID`. */
export const bulkEditBody = (ids: TargetIds, rest = false): Readonly<Record<string, unknown>> => ({
  productIds: [rest ? rawTestId(ids.productId) : ids.productId],
  changes: { status: 'draft' },
});

/** The selection a `reported` call answers with: one result per named product. */
export const BULK_EDIT_RESULT_FIELDS = 'results { productId ok changedFields error }';

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'bulkEditCatalogProducts',
    access: 'catalog.products.edit',
    foreign: 'reported',
    notFound: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND,
    document: `mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { ${BULK_EDIT_RESULT_FIELDS} } }`,
    variables: (ids) => ({ input: bulkEditBody(ids) }),
  },
];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  {
    method: 'POST',
    route: '/catalog/products/bulk-edit',
    access: 'catalog.products.edit',
    foreign: 'reported',
    notFound: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND,
    url: () => '/catalog/products/bulk-edit',
    body: (ids) => bulkEditBody(ids, true),
  },
];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
