import { STOREFRONT_API_ROUTES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { declaredRoutes } from './declared-handlers';
import { STOREFRONT_ROUTE_PERMISSION, STOREFRONT_ROUTES } from './storefront-registry';

/** A route with a `:param` segment; a literal route must come before it on the same prefix. */
const PARAM_SEGMENT = /\/:[^/]+/;

describe('the storefront API endpoint registry', () => {
  it('has an entry for every route the controllers declare, each public', () => {
    // Act
    const entries = STOREFRONT_ROUTES.map((route) => ({
      key: `${route.method} ${route.path}`,
      allow: STOREFRONT_ROUTE_PERMISSION,
    }));

    // Assert
    expect([...entries].sort((a, b) => a.key.localeCompare(b.key))).toEqual(
      [...declaredRoutes()].sort((a, b) => a.key.localeCompare(b.key)),
    );
  });

  it('serves every catalog and quote route of the shared storefront contract (P3.S2 Task 4, P3.S3)', () => {
    // Arrange
    const shared = [
      `GET ${STOREFRONT_API_ROUTES.products}`,
      `GET ${STOREFRONT_API_ROUTES.productSearch}`,
      `GET ${STOREFRONT_API_ROUTES.product}/:slug`,
      `GET ${STOREFRONT_API_ROUTES.collections}`,
      `GET ${STOREFRONT_API_ROUTES.collection}/:slug`,
      `POST ${STOREFRONT_API_ROUTES.shippingQuote}`,
    ];

    // Act
    const served = declaredRoutes().map((route) => route.key);

    // Assert
    expect(served.sort()).toEqual(shared.sort());
  });

  it('declares product/search before product/:slug, which would otherwise take it', () => {
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
    expect(routes.indexOf('GET /store/product/search')).toBeLessThan(routes.indexOf('GET /store/product/:slug'));
  });
});
