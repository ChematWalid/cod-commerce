import type { ProductChangeKind } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** Tells later sessions a product changed (`product.changed`, D2127), in the write transaction of the change. */
export interface ProductEventsPort {
  publish(ctx: OperationContext, scope: StoreScope, productId: CoreId, change: ProductChangeKind): Promise<void>;
}
