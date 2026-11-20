import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { offersAdminApiSchema } from '../../api/schema';
import { declaredOperations, declaredRoutes, permissionNameOf } from './declared-handlers';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './endpoint-registry';

const byKey = (left: { key: string }, right: { key: string }): number => left.key.localeCompare(right.key);

describe('the offers endpoint registry', () => {
  it('registers every declared offers operation with the permission its guard gives', () => {
    // Act
    const entries = OPERATION_REGISTRY.map((entry) => ({
      key: operationKey(entry),
      allow: permissionNameOf(entry.access),
    }));

    // Assert
    expect(entries.sort(byKey)).toEqual([...declaredOperations()].sort(byKey));
  });

  it('registers every declared offers route with the permission its guard gives', () => {
    // Act
    const entries = ROUTE_REGISTRY.map((entry) => ({ key: routeKey(entry), allow: permissionNameOf(entry.access) }));

    // Assert
    expect(entries.sort(byKey)).toEqual([...declaredRoutes()].sort(byKey));
  });

  it('has an entry for every operation of the plugin schema', () => {
    // Act
    const inRegistry = OPERATION_REGISTRY.map(operationKey).sort();

    // Assert
    expect(inRegistry).toEqual(adminOperationsOf(offersAdminApiSchema));
  });

  it('leaves no handler without a permission', () => {
    // Act
    const unguarded = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.allow === 'unguarded');

    // Assert
    expect(unguarded).toEqual([]);
  });

  it('declares the app-types and preview routes before the :id route, which would otherwise take them (D2518)', () => {
    // Act
    const routes = declaredRoutes().map((entry) => entry.key);

    // Assert
    expect(routes.indexOf('GET /offers/app-types')).toBeLessThan(routes.indexOf('GET /offers/:id'));
    expect(routes.indexOf('POST /offers/preview')).toBeLessThan(routes.indexOf('POST /offers/:id/publish'));
  });
});
