import type { TenantScope } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { OperationContext } from './operation-context';

/**
 * Keeps a product save and the delete of an image it names apart (D2128). Without it a save could check the media row,
 * the delete could find no committed use and remove the asset, and the save would then commit a product whose image
 * Vendure's foreign keys silently cleared (featured image set to null, gallery row cascaded). Both locks last until
 * the transaction of `ctx` ends; a save takes them after its taxonomy locks and before its product lock, a delete
 * before its in-use check and takes no other lock, so the orders never cross. The locks are keyed by `scope`'s
 * business, so a caller naming another business's image never holds that business's lock.
 */
export interface MediaLockPort {
  /** Taken by a product save for every image id it names; saves never wait on each other. */
  share(ctx: OperationContext, scope: TenantScope, assetIds: readonly CoreId[]): Promise<void>;

  /** Taken by the delete of the image `assetId`: waits for every save naming it, and every later save waits for it. */
  exclusive(ctx: OperationContext, scope: TenantScope, assetId: CoreId): Promise<void>;
}
