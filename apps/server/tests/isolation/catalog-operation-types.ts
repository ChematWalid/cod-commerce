import type { IsolationEntity } from './matrix';

/** The shapes of the catalog endpoint lists (`catalog-operations.ts`, `catalog-sold-out-operations.ts`). */

/** The rows of a business a call may name; for REST the product id is the REST form (`restIdOf`). */
export interface CatalogTarget {
  readonly productId: string;
  readonly variantId: string;
  readonly brandId: string;
  readonly tagId: string;
  readonly highlightId: string;
  readonly mediaId: string;
  readonly assetId: string;
  readonly collectionId: string;
  readonly slug: string;
}

/** The field of {@link CatalogTarget} a by-id endpoint names. */
export type TargetField = 'productId' | 'brandId' | 'tagId' | 'highlightId' | 'mediaId';

/** What a by-id endpoint answers for an id that is not a row of the caller's store. */
export interface ById {
  readonly field: TargetField;
  /** The error code; `null` for a read whose answer is a null field instead. */
  readonly notFound: string | null;
}

/** One Admin API operation. */
export interface CatalogOperation {
  readonly name: string;
  readonly entity: IsolationEntity;
  readonly document: string;
  readonly variables: (target: CatalogTarget) => Record<string, unknown>;
  readonly byId?: ById;
  /** Sent as a multipart upload of a one-pixel PNG at `$file`. */
  readonly upload?: true;
}

/** One REST route. */
export interface CatalogRoute {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The route as the controller declares it, e.g. `/catalog/products/:id`. */
  readonly route: string;
  readonly entity: IsolationEntity;
  readonly path: (target: CatalogTarget) => string;
  readonly body?: () => Record<string, unknown>;
  readonly byId?: ById & { readonly notFound: string };
}
