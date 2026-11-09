import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { adminApiSchema } from '../../api/schema';
import { declaredOperations, declaredRoutes, permissionNameOf } from './declared-handlers';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './endpoint-registry';

const byKey = (left: { key: string }, right: { key: string }): number => left.key.localeCompare(right.key);

describe('the rbac endpoint registry', () => {
  it('has an entry for every operation the resolvers declare, with the permission its @Allow gives, and none for a removed one', () => {
    // Act
    const entries = OPERATION_REGISTRY.map((entry) => ({
      key: operationKey(entry),
      allow: permissionNameOf(entry.access),
    })).sort(byKey);

    // Assert
    expect(entries).toEqual([...declaredOperations()].sort(byKey));
  });

  it('has an entry for every REST route the controllers declare, with the permission its @Allow gives, and none for a removed one', () => {
    // Act
    const entries = ROUTE_REGISTRY.map((entry) => ({
      key: routeKey(entry),
      allow: permissionNameOf(entry.access),
    })).sort(byKey);

    // Assert
    expect(entries).toEqual([...declaredRoutes()].sort(byKey));
  });

  it('has an entry for every operation of the plugin schema', () => {
    // Act
    const inSchema = adminOperationsOf(adminApiSchema);
    const inRegistry = OPERATION_REGISTRY.map(operationKey).sort();

    // Assert
    expect(inRegistry).toEqual(inSchema);
  });

  it('leaves no handler without a permission', () => {
    // Act
    const unguarded = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.allow === 'unguarded');

    // Assert
    expect(unguarded).toEqual([]);
  });

  it('lets no handler be public', () => {
    // Act
    const open = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.allow.includes('Public'));

    // Assert
    expect(open).toEqual([]);
  });
});
