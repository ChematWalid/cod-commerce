import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/** A product's text as the merchant wrote it, and as a polisher gives it back. */
export interface ProductText {
  readonly title: string;
  readonly description?: string;
}

/**
 * Rewrites a product's text (D2215). P2.S2 ships the identity adapter; P9.S7b plugs the AI one in behind this port.
 * The caller checks the `ai.enabled` kill switch first.
 */
export interface ProductPolisher {
  polish(scope: StoreScope, text: ProductText): Promise<ProductText>;
}

/** Reads a product's text in the scope's store through catalog's facade (D2201). */
export interface ProductTextReads {
  /** The product's title and description, or `undefined` (another store's or business's, deleted, malformed id). */
  textOf(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ProductText | undefined>;
}
