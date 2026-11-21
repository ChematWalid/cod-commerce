import { type Snowflake, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { OfferRecord, StoredCode } from '../../domain/offer-record';
import type { StoreScope } from '../../domain/store-scope';
import { T0 } from './builders';

/** Store 1 of business A, store 2 of business A, and the store of business B. */
export const scopeA: StoreScope = { businessId: toBusinessId('101'), storeId: toStoreId('1001') };
export const scopeA2: StoreScope = { businessId: toBusinessId('101'), storeId: toStoreId('1002') };
export const scopeB: StoreScope = { businessId: toBusinessId('202'), storeId: toStoreId('2001') };

let nextId = 1_300_000_000_000_000_001n;

/** A fresh id, unique for the whole run, so adapters that keep rows never collide. */
export function newId(): Snowflake {
  const id = toSnowflake(String(nextId));
  nextId += 1n;
  return id;
}

/** A valid quantity configuration: 10 % off from two pieces, as the kind's schema outputs it. */
export const TWO_PIECE_CONFIG = {
  priceMode: 'percent',
  tiers: [{ quantity: 2, price: 10, preselected: false, freeDelivery: false }],
};

/** A draft quantity offer made at {@link T0} on variant 11, with a fresh id. */
export function anOfferRecord(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    id: newId(),
    kind: 'quantity',
    method: 'automatic',
    title: 'Buy more, save more',
    label: {},
    config: TWO_PIECE_CONFIG,
    combinesWith: { order: false, product: false, delivery: false },
    eligibility: { audience: 'everyone', channels: [], wilayas: [], deliveryMethods: [] },
    totalUsageLimit: null,
    perBuyerLimit: null,
    status: 'draft',
    startsAt: null,
    endsAt: null,
    publishedAt: null,
    pausedAt: null,
    archivedAt: null,
    usageCount: 0,
    version: 1,
    targets: [{ role: 'buy', refType: 'variant', refId: '11' }],
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

/** An active offer published at {@link T0}. */
export const anActiveOffer = (overrides: Partial<OfferRecord> = {}): OfferRecord =>
  anOfferRecord({ status: 'active', publishedAt: T0, ...overrides });

/** A stored code of `offerId`, unused and unlimited, made at {@link T0}. */
export function aCode(offerId: Snowflake, code = 'INFLU10', overrides: Partial<StoredCode> = {}): StoredCode {
  return { id: newId(), offerId, code, usageLimit: null, usageCount: 0, createdAt: T0, ...overrides };
}
