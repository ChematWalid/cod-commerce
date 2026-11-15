import { type CollectionRule, type Snowflake, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { CollectionDefinition } from '../../domain/collection';
import type { StoreScope } from '../../domain/store-scope';

/** Store 1 of business A, store 2 of business A, and the store of business B. */
export const scopeA: StoreScope = { businessId: toBusinessId('101'), storeId: toStoreId('1001') };
export const scopeA2: StoreScope = { businessId: toBusinessId('101'), storeId: toStoreId('1002') };
export const scopeB: StoreScope = { businessId: toBusinessId('202'), storeId: toStoreId('2001') };

let nextId = 1_400_000_000_000_000_001n;

/** A fresh snowflake, unique for the whole run, so adapters that keep rows never collide. */
export function newId(): Snowflake {
  const id = toSnowflake(String(nextId));
  nextId += 1n;
  return id;
}

let nextCoreId = 700_001;

/** A fresh Vendure core id (collection or product), as a decimal string. */
export function newCoreId(): string {
  nextCoreId += 1;
  return String(nextCoreId);
}

/** A version-1 rule "Price between `min` and `max`". */
export const priceRule = (min: number, max: number): CollectionRule => ({
  version: 1,
  match: 'all',
  conditions: [{ field: 'price', operator: 'between', min, max }],
});

/** A manual, visible definition of a fresh collection of `scope` at position 0, with any field overridden. */
export function definitionOf(scope: StoreScope, overrides: Partial<CollectionDefinition> = {}): CollectionDefinition {
  return {
    id: newId(),
    collectionId: newCoreId(),
    storeId: scope.storeId,
    mode: 'manual',
    rule: null,
    matchVersion: 1,
    visible: true,
    position: 0,
    ...overrides,
  };
}

/** An automatic definition of a fresh collection of `scope` with a price rule. */
export const automaticOf = (scope: StoreScope, overrides: Partial<CollectionDefinition> = {}): CollectionDefinition =>
  definitionOf(scope, { mode: 'automatic', rule: priceRule(1_000, 5_000), ...overrides });
