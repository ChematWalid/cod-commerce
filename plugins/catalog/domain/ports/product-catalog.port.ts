import type { ProductStatus, Snowflake } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { ProductDraft, ProductRecord, ProductUpdate } from '../product';
import type { MatrixPlan } from '../variant-matrix';
import type { OperationContext } from './operation-context';

/** Which products a list page holds; every field narrows the list (AND, D2123). */
export interface ProductCriteria {
  /** Only these products, when given (search, tag and collection pre-queries); an empty list matches nothing. */
  readonly productIds?: readonly CoreId[];
  readonly status?: ProductStatus;
  readonly brandId?: Snowflake;
  readonly skip: number;
  readonly take: number;
}

/** The products of one list page, newest first, and how many match in all. */
export interface ProductPage {
  readonly items: readonly ProductRecord[];
  readonly totalItems: number;
}

/** A slug as the store keeps it, and the product of the store that holds it, if any. */
export interface SlugLookup {
  readonly slug: string;
  readonly productId: CoreId | undefined;
}

/**
 * The products of the caller's store channel, on Vendure's own entities (D2100). Every call runs in the active store
 * channel of `ctx`: a product of another channel is not found. Strings are written in the store's language (D2112).
 */
export interface ProductCatalogPort {
  /** Stores a new product with the variants of `plan` (D2124) and returns it as read back. */
  create(ctx: OperationContext, draft: ProductDraft, plan: MatrixPlan): Promise<ProductRecord>;

  /** Applies `update` to the product `id` of the store and returns it as read back; `undefined` when none. */
  update(ctx: OperationContext, id: CoreId, update: ProductUpdate): Promise<ProductRecord | undefined>;

  /** The live product `id` of the store, or `undefined`. */
  findOne(ctx: OperationContext, id: CoreId): Promise<ProductRecord | undefined>;

  /** One page of the store's products matching `criteria`, newest first. */
  list(ctx: OperationContext, criteria: ProductCriteria): Promise<ProductPage>;

  /** Soft-deletes the product `id` of the store and its variants; `false` when none. */
  softDelete(ctx: OperationContext, id: CoreId): Promise<boolean>;

  /** Normalises `slug` as the store stores slugs and names the live product of the store holding it. */
  findBySlug(ctx: OperationContext, slug: string): Promise<SlugLookup>;

  /** The collections of the store among `ids`; others, of another channel or none at all, are left out (D2134). */
  existingCollections(ctx: OperationContext, ids: readonly CoreId[]): Promise<readonly CoreId[]>;
}
