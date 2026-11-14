import { type Snowflake, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { Highlight } from '../../domain/highlight';
import type { MediaItem } from '../../domain/media-item';
import type { ProductSettings } from '../../domain/product-settings';
import type { StoreScope } from '../../domain/store-scope';
import { type Brand, createBrand, createTag, type Tag } from '../../domain/taxonomy';

/** Store 1 of business A, store 2 of business A, and the store of business B. */
export const scopeA: StoreScope = { businessId: toBusinessId('101'), storeId: toStoreId('1001') };
export const scopeA2: StoreScope = { businessId: toBusinessId('101'), storeId: toStoreId('1002') };
export const scopeB: StoreScope = { businessId: toBusinessId('202'), storeId: toStoreId('2001') };

/** A fixed instant the builders date their rows from. */
export const T0 = new Date(Date.UTC(2026, 10, 14, 9, 0, 0));

const MINUTE_MS = 60_000;

/** {@link T0} plus `minutes`, for rows whose order depends on their date. */
export const at = (minutes: number): Date => new Date(T0.getTime() + minutes * MINUTE_MS);

let nextId = 1_200_000_000_000_000_001n;

/** A fresh id, unique for the whole run, so adapters that keep rows never collide. */
export function newId(): Snowflake {
  const id = toSnowflake(String(nextId));
  nextId += 1n;
  return id;
}

let nextCoreId = 500_001;

/** A fresh Vendure core id (product or asset), as the decimal string the catalog carries. */
export function newCoreId(): string {
  nextCoreId += 1;
  return String(nextCoreId);
}

/** A brand of `scope` named `name`, made at `now`. */
export function brandOf(scope: StoreScope, name = `Brand ${newId()}`, now = T0): Brand {
  return createBrand({ id: newId(), scope, name, now });
}

/** A tag of `scope` named `name`, made at `now`. */
export function tagOf(scope: StoreScope, name = `Tag ${newId()}`, now = T0): Tag {
  return createTag({ id: newId(), scope, name, now });
}

/** A highlight of `scope`, made at `now`. */
export function highlightOf(scope: StoreScope, text = `Fast delivery ${newId()}`, now = T0): Highlight {
  return { id: newId(), businessId: scope.businessId, storeId: scope.storeId, text, createdAt: now, updatedAt: now };
}

/** The settings of `productId` in `scope`, with any field overridden. */
export function settingsOf(
  scope: StoreScope,
  productId: string,
  overrides: Partial<ProductSettings> = {},
): ProductSettings {
  return {
    id: newId(),
    businessId: scope.businessId,
    storeId: scope.storeId,
    productId,
    nameInDelivery: null,
    isFragile: false,
    allowParcelOpening: true,
    allowOutOfStockOrders: true,
    soldOut: false,
    quantityRules: { enabled: false, min: 1, step: 1 },
    orderManagerIds: [],
    customAttributes: [],
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

/** A media item uploaded in `scope` at `now`. */
export function mediaOf(scope: StoreScope, now = T0): MediaItem {
  return { id: newId(), businessId: scope.businessId, storeId: scope.storeId, assetId: newCoreId(), createdAt: now };
}
