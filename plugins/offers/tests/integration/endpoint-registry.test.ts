import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { offersAdminApiSchema } from '../../api/schema';
import { declaredOperations, declaredRoutes, permissionNameOf } from './declared-handlers';
import { idFieldOf, OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './endpoint-registry';

/** The handlers whose only foreign input is the variant a draft targets, in registry order. */
const SENDS_A_VARIANT = ['previewOffer', 'createOffer', 'POST /offers/preview', 'POST /offers'];

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

  it('declares the app-types route before the :id route, which would otherwise take it (D2518)', () => {
    // Act
    const routes = declaredRoutes().map((entry) => entry.key);
    const appTypes = routes.indexOf('GET /offers/app-types');
    const byId = routes.indexOf('GET /offers/:id');

    // Assert
    expect(appTypes).toBeGreaterThanOrEqual(0);
    expect(byId).toBeGreaterThanOrEqual(0);
    expect(appTypes).toBeLessThan(byId);
  });

  it('aims every create and preview at the variant it sends, creates as dangling references (D2536)', () => {
    // Act
    const sendsAVariant = [
      ...OPERATION_REGISTRY.filter((entry) => SENDS_A_VARIANT.includes(operationKey(entry))),
      ...ROUTE_REGISTRY.filter((entry) => SENDS_A_VARIANT.includes(routeKey(entry))),
    ].map((entry) => ({ id: idFieldOf(entry), foreign: entry.foreign }));

    // Assert
    expect(sendsAVariant).toEqual([
      { id: 'variantId', foreign: 'no-read' },
      { id: 'variantId', foreign: 'dangling' },
      { id: 'variantId', foreign: 'no-read' },
      { id: 'variantId', foreign: 'dangling' },
    ]);
  });

  it('leaves no own-only entry that names no offer of its own', () => {
    // Act
    const ownOnly = [...OPERATION_REGISTRY, ...ROUTE_REGISTRY].filter((entry) => entry.foreign === 'own-only');

    // Assert
    expect(ownOnly.map((entry) => ('operation' in entry ? entry.operation : routeKey(entry)))).toEqual([
      'offers',
      'GET /offers',
    ]);
  });
});
