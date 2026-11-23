import type { StorefrontCollection, StorefrontProduct } from '@cod/shared';
import type { OperationContext } from './operation-context';

/**
 * The catalog and collections reads a storefront page needs beside the projection, through the storefront context of
 * the signed store (D3201, D3206). A hidden, draft, other-store or unknown product or collection reads like none.
 */
export interface StorefrontReadsPort {
  /** The product page of `slug` (catalog `productPage` visibility), or `undefined`. */
  productBySlug(ctx: OperationContext, slug: string): Promise<StorefrontProduct | undefined>;

  /** The store's visible collections by position, at most `take`. */
  collections(ctx: OperationContext, take: number): Promise<readonly StorefrontCollection[]>;

  /** The visible collection of `slug`, or `undefined`. */
  collectionBySlug(ctx: OperationContext, slug: string): Promise<StorefrontCollection | undefined>;

  /** The ids of every product in the visible collection `collectionId` (membership only), or `undefined`. */
  memberIds(ctx: OperationContext, collectionId: string): Promise<readonly string[] | undefined>;
}
