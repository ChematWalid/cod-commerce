import { adminOperationsOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { authAdminApiSchema } from '../../api/schema';
import { declaredOperations, declaredRoutes } from './declared-handlers';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey } from './endpoint-registry';

const byKey = (left: { key: string }, right: { key: string }): number => left.key.localeCompare(right.key);
const registered = <T>(entries: readonly T[], keyOf: (entry: T) => string, access: (entry: T) => string) =>
  entries.map((entry) => ({ key: keyOf(entry), access: access(entry) })).sort(byKey);

describe('the auth endpoint registry', () => {
  it('has an entry for every operation the resolvers declare, with the access its @Allow gives, and none for a removed one', () => {
    // Act
    const entries = registered(OPERATION_REGISTRY, operationKey, (entry) => entry.access);

    // Assert
    expect(entries).toEqual([...declaredOperations()].sort(byKey));
  });

  it('has an entry for every REST route the controllers declare, with the access its @Allow gives, and none for a removed one', () => {
    // Act
    const entries = registered(ROUTE_REGISTRY, routeKey, (entry) => entry.access);

    // Assert
    expect(entries).toEqual([...declaredRoutes()].sort(byKey));
  });

  it('has an entry for every operation of the plugin schema', () => {
    // Act
    const inSchema = adminOperationsOf(authAdminApiSchema);
    const inRegistry = OPERATION_REGISTRY.filter((entry) => entry.api === 'admin').map((entry) => entry.operation);

    // Assert
    expect(inRegistry).toEqual(expect.arrayContaining(inSchema));
  });

  it('gives every public route the answer its fixture must get', () => {
    // Act
    const unanswered = ROUTE_REGISTRY.filter((entry) => entry.access === 'public' && entry.answer === undefined);

    // Assert
    expect(unanswered.map(routeKey)).toEqual([]);
  });

  it('leaves no handler without an @Allow', () => {
    // Act
    const unguarded = [...declaredOperations(), ...declaredRoutes()].filter((entry) => entry.access === 'unguarded');

    // Assert
    expect(unguarded).toEqual([]);
  });
});
