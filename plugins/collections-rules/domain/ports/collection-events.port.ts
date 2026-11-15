import type { CollectionChangeKind } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** Publishes `collection.changed` (D2335) in the writing transaction of `ctx`, so the change and its event commit together. */
export interface CollectionEventsPort {
  publish(ctx: OperationContext, scope: StoreScope, collectionId: string, change: CollectionChangeKind): Promise<void>;
}
