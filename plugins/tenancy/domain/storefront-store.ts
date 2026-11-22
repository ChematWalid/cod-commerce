import {
  type BusinessId,
  isPlatformLanguageCode,
  isSnowflake,
  type PlatformLanguageCode,
  type SoldOutBehavior,
  type StoreId,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import type { HostStoreRow } from './ports/host-store-lookup.port';

/**
 * The store a storefront call runs for (D3201): the one the internal signature named, active, of an active business.
 * What plugins serving the storefront read of it without another query.
 */
export interface StorefrontStoreContext {
  readonly storeId: StoreId;
  readonly businessId: BusinessId;
  readonly channelId: number;
  readonly soldOutBehavior: SoldOutBehavior;
  readonly language: PlatformLanguageCode;
}

/** The store id a signature carried, when it has the form of one; anything else names no store. */
export function toSignedStoreId(raw: string): StoreId | undefined {
  return isSnowflake(raw) ? toStoreId(raw) : undefined;
}

/**
 * The storefront facts of a served store row, or `undefined` when its language is not a platform one (languages are
 * checked on every write, so such a row can be rendered by no storefront).
 */
export function toStorefrontStore(row: HostStoreRow): StorefrontStoreContext | undefined {
  if (!isPlatformLanguageCode(row.language)) return undefined;
  return {
    storeId: toStoreId(row.storeId),
    businessId: toBusinessId(row.businessId),
    channelId: row.channelId,
    soldOutBehavior: row.soldOutBehavior,
    language: row.language,
  };
}
