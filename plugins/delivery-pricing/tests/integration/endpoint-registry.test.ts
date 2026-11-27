import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { deliveryPricingAdminApiSchema } from '../../api/schema';
import { declaredOperations, declaredRoutes, permissionNameOf } from './declared-handlers';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './endpoint-registry';

const byKey = (left: { key: string }, right: { key: string }): number => left.key.localeCompare(right.key);

describe('the delivery-pricing endpoint registry', () => {
  it('has an entry for every operation the resolvers declare, with the permission its @Allow gives', () => {
    // Act
    const entries = OPERATION_REGISTRY.map((entry) => ({
      key: operationKey(entry),
      allow: permissionNameOf(entry.access),
    }));

    // Assert
    expect(entries.sort(byKey)).toEqual([...declaredOperations()].sort(byKey));
  });

  it('has an entry for every REST route the controllers declare, with the permission its @Allow gives', () => {
    // Act
    const entries = ROUTE_REGISTRY.map((entry) => ({ key: routeKey(entry), allow: permissionNameOf(entry.access) }));

    // Assert
    expect(entries.sort(byKey)).toEqual([...declaredRoutes()].sort(byKey));
  });

  it('has an entry for every operation of the plugin schema', () => {
    // Act
    const inRegistry = OPERATION_REGISTRY.map(operationKey).sort();

    // Assert
    expect(inRegistry).toEqual(adminOperationsOf(deliveryPricingAdminApiSchema));
  });

  it('leaves no handler without a permission', () => {
    // Act
    const unguarded = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.allow === 'unguarded');

    // Assert
    expect(unguarded).toEqual([]);
  });

  it('keeps every route under /delivery-fees (the REST mirror)', () => {
    // Act
    const outside = declaredRoutes().filter((entry) => !entry.key.split(' ')[1]?.startsWith('/delivery-fees'));

    // Assert
    expect(outside).toEqual([]);
  });
});
