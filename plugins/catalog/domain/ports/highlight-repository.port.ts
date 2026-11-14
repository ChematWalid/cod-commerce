import type { Snowflake } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { Highlight } from '../highlight';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** Where a store's highlights and the ordered product links to them are kept (`catalog_product_highlight`). */
export interface HighlightRepositoryPort {
  /** Stores a new highlight under the scope's store. */
  insert(ctx: OperationContext, scope: StoreScope, highlight: Highlight): Promise<void>;

  /** The highlight `id` of the scope's store, or `undefined`. */
  findById(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<Highlight | undefined>;

  /** The highlights of the scope's store among `ids`, in no set order; ids of other stores are left out. */
  findByIds(ctx: OperationContext, scope: StoreScope, ids: readonly Snowflake[]): Promise<readonly Highlight[]>;

  /** Every highlight of the scope's store, newest first, then by id descending. */
  list(ctx: OperationContext, scope: StoreScope): Promise<readonly Highlight[]>;

  /** Replaces the text and update date of `highlight.id`; `false` when the store has no such highlight. */
  update(ctx: OperationContext, scope: StoreScope, highlight: Highlight): Promise<boolean>;

  /** Deletes the highlight `id` and its product links; `false` when the store has no such highlight. */
  delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean>;

  /** Replaces every highlight link of `productId` in the scope's store; the list order is the display order. */
  replaceProductHighlights(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    highlightIds: readonly Snowflake[],
  ): Promise<void>;

  /** The highlight ids of `productId` in the scope's store, in display order. */
  highlightIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly Snowflake[]>;
}
