import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { collectionsRulesAdminApiSchema } from '../../api/schema';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './collections-registry';
import { declaredOperations, declaredRoutes, permissionNameOf } from './declared-handlers';

const byKey = (left: { key: string }, right: { key: string }): number => left.key.localeCompare(right.key);

/** A route with a `:param` segment; a literal route must come before it on the same prefix. */
const PARAM_SEGMENT = /\/:[^/]+/;

describe('the collections endpoint registry', () => {
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
    expect(inRegistry).toEqual(adminOperationsOf(collectionsRulesAdminApiSchema));
  });

  it('leaves no handler without a permission', () => {
    // Act
    const unguarded = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.allow === 'unguarded');

    // Assert
    expect(unguarded).toEqual([]);
  });

  it('declares every literal route before the :id route of its method, which would otherwise take it (D2315)', () => {
    // Arrange
    const routes = declaredRoutes().map((entry) => entry.key);

    // Act
    const shadowed = routes.filter((route, index) => {
      const [method, path = ''] = route.split(' ');
      return routes.slice(0, index).some((earlier) => {
        const [earlierMethod, earlierPath = ''] = earlier.split(' ');
        if (earlierMethod !== method || !PARAM_SEGMENT.test(earlierPath)) return false;
        const pattern = new RegExp(`^${earlierPath.replaceAll(/:[^/]+/g, '[^/]+')}$`);
        return !PARAM_SEGMENT.test(path) && pattern.test(path);
      });
    });

    // Assert
    expect(shadowed).toEqual([]);
  });
});
