import type { BusinessId, StoreId } from '@cod/shared';
import type { SoldOutBehavior, StoreStatus } from '../store';
import type { OperationContext } from './operation-context';

/** The store settings other plugins act on: what a sold-out product does, the content language and the channel. */
export interface StoreSettings {
  readonly soldOutBehavior: SoldOutBehavior;
  readonly language: string;
  readonly channelId: number;
  readonly status: StoreStatus;
}

/**
 * A read-only view of one store's settings for other plugins (D2106). The caller names the business, and a store of
 * another business answers `null`, like a missing one. An abstract class: plugins inject it by type.
 *
 * For jobs and other code that runs outside a request: the caller passes the business the job was enqueued for, never
 * a business id read from input. Request handlers inject `RequestStoreSettings` instead, which takes the business from
 * the request's tenant. Archived stores are returned too, so a consumer checks `status` before acting on one.
 */
export abstract class StoreSettingsReader {
  /** The settings of `storeId` in `businessId`, archived stores too, or `null` when the business has no such store. */
  abstract settingsOf(ctx: OperationContext, businessId: BusinessId, storeId: StoreId): Promise<StoreSettings | null>;
}
