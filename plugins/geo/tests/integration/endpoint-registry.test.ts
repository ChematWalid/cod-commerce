import { Permission } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { declaredRoutes } from './declared-handlers';
import { ROUTE_REGISTRY, routeKey } from './endpoint-registry';

/** The internal-only prefix of the storefront's store lookups (D112, `platform-webhooks/domain/internal-prefixes.ts`). */
const SIGNED_PREFIX = '/store/';
/** The permission name `@Allow(Permission.Public)` stores. */
const PUBLIC: string = Permission.Public;

const accessOf = (key: string): string | undefined => ROUTE_REGISTRY.find((entry) => routeKey(entry) === key)?.access;

describe('the geo endpoint registry', () => {
  it('has an entry for every REST route the controllers declare', () => {
    // Act
    const declared = declaredRoutes().map((route) => route.key);

    // Assert
    expect(ROUTE_REGISTRY.map(routeKey).sort()).toEqual(declared.sort());
  });

  it('marks every route explicitly public: no merchant session reaches them', () => {
    // Act
    const notPublic = declaredRoutes().filter((route) => route.allow !== PUBLIC);

    // Assert
    expect(notPublic).toEqual([]);
  });

  it('rate-limits every public route by client address and no signed one (D3117)', () => {
    // Act
    const limits = declaredRoutes().map((route) => ({ key: route.key, rateLimit: route.rateLimit }));

    // Assert
    expect(limits).toEqual(
      declaredRoutes().map((route) => ({
        key: route.key,
        rateLimit: accessOf(route.key) === 'public' ? 'provinces-ip' : undefined,
      })),
    );
  });

  it('keeps every signed route under the internal-only prefix and no public one (D3106)', () => {
    // Act
    const misplaced = ROUTE_REGISTRY.filter(
      (entry) => entry.route.startsWith(SIGNED_PREFIX) !== (entry.access === 'signed'),
    );

    // Assert
    expect(misplaced).toEqual([]);
  });
});
