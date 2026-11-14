import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { catalogAdminApiSchema } from '../../api/schema';
import { declaredOperations, declaredRoutes, permissionNameOf } from './declared-handlers';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './endpoint-registry';

const byKey = (left: { key: string }, right: { key: string }): number => left.key.localeCompare(right.key);

describe('the catalog endpoint registry', () => {
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
    expect(inRegistry).toEqual(adminOperationsOf(catalogAdminApiSchema));
  });

  it('leaves no handler without a permission', () => {
    // Act
    const unguarded = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.allow === 'unguarded');

    // Assert
    expect(unguarded).toEqual([]);
  });

  it('declares the slug route before the :id route, which would otherwise take it (D2103)', () => {
    // Act
    const routes = declaredRoutes().map((entry) => entry.key);

    // Assert
    expect(routes.indexOf('GET /catalog/products/slug-availability')).toBeLessThan(
      routes.indexOf('GET /catalog/products/:id'),
    );
  });
});
