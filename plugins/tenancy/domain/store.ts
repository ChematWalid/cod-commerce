import type { BusinessId, Snowflake, SoldOutBehavior, StoreId } from '@cod/shared';

/** The statuses a store can have. */
export const STORE_STATUSES = ['active', 'archived'] as const;

/** One of the {@link STORE_STATUSES}. */
export type StoreStatus = (typeof STORE_STATUSES)[number];

export { SOLD_OUT_BEHAVIORS, type SoldOutBehavior } from '@cod/shared';

/** A shop of a business, mapped one to one onto a Vendure channel. */
export interface Store {
  readonly id: StoreId;
  readonly businessId: Snowflake;
  readonly storeId: StoreId;
  readonly channelId: number;
  readonly sellerId: number;
  readonly name: string;
  readonly description: string;
  readonly logoAssetId: number | null;
  readonly language: string;
  readonly subdomain: string;
  readonly defaultDeliveryFeeGroupId: Snowflake | null;
  readonly defaultCarrierId: Snowflake | null;
  readonly showAddressField: boolean;
  readonly soldOutBehavior: SoldOutBehavior;
  readonly status: StoreStatus;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A request to open a store. */
export interface CreateStoreInput {
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
  readonly description?: string;
  readonly logoAssetId?: number;
}

/** What a merchant can change on a store, apart from its subdomain. Absent keys stay as they are. */
export type StorePatch = Partial<
  Pick<
    Store,
    | 'name'
    | 'description'
    | 'logoAssetId'
    | 'language'
    | 'defaultDeliveryFeeGroupId'
    | 'defaultCarrierId'
    | 'showAddressField'
    | 'soldOutBehavior'
  >
>;

/** The facts only the use case knows about a new store. */
export interface NewStore {
  readonly id: StoreId;
  readonly businessId: Snowflake;
  readonly channelId: number;
  readonly sellerId: number;
  readonly subdomain: string;
  readonly input: CreateStoreInput;
  readonly now: Date;
}

/** A new active store with the platform defaults. `subdomain` is already normalised. */
export function newStore({ id, businessId, channelId, sellerId, subdomain, input, now }: NewStore): Store {
  return {
    id,
    businessId,
    // A store's rows are scoped by store, and the store row is its own scope.
    storeId: id,
    channelId,
    sellerId,
    name: input.name,
    description: input.description ?? '',
    logoAssetId: input.logoAssetId ?? null,
    language: input.language,
    subdomain,
    defaultDeliveryFeeGroupId: null,
    defaultCarrierId: null,
    showAddressField: true,
    soldOutBehavior: 'keep',
    status: 'active',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Who is acting on stores: their business, and the channels on which they hold the permission in question. */
export interface StoreActor {
  readonly businessId: BusinessId;
  readonly channelIds: readonly number[];
}

/** The part of a store that decides who may act on it. */
export interface StoreAccess {
  readonly id: StoreId;
  readonly channelId: number;
  readonly status: StoreStatus;
}
