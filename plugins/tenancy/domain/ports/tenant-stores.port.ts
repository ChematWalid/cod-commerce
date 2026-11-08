import type { BusinessId, StoreId } from '@cod/shared';
import type { Store } from '../store';
import type { OperationContext } from './operation-context';

/** The columns a use case may change on a store. */
export type StoreWrite = Partial<Omit<Store, 'id' | 'businessId' | 'storeId' | 'channelId' | 'sellerId' | 'createdAt'>>;

/** A business's own stores. Every call is confined to `businessId`. */
export interface TenantStoresPort {
  list(ctx: OperationContext, businessId: BusinessId): Promise<readonly Store[]>;
  find(ctx: OperationContext, businessId: BusinessId, id: StoreId): Promise<Store | undefined>;
  countActive(ctx: OperationContext, businessId: BusinessId): Promise<number>;
  /** @throws {SubdomainTakenError} when `write.subdomain` loses a race for the unique subdomain. */
  update(ctx: OperationContext, businessId: BusinessId, id: StoreId, write: StoreWrite): Promise<void>;
}
