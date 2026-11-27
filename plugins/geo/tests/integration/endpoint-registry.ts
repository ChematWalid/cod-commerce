/**
 * Who may call a geo route: `public` is unauthenticated, IP rate-limited reference data (D3117); `signed` sits under
 * the internal-only `/store` prefix (D112), reached only by the storefront server with the internal signature (D3106).
 * Neither takes a permission key: no merchant session reaches them.
 */
export type GeoRouteAccess = 'public' | 'signed';

/** One REST route of the geo plugin. */
export interface GeoRouteEntry {
  readonly method: 'GET';
  /** The route as the controller declares it. */
  readonly route: string;
  readonly access: GeoRouteAccess;
}

/** Every REST route of the plugin; `endpoint-registry.test` fails on a declared route without an entry. */
export const ROUTE_REGISTRY: readonly GeoRouteEntry[] = [
  { method: 'GET', route: '/provinces', access: 'public' },
  { method: 'GET', route: '/provinces/code/:code', access: 'public' },
  { method: 'GET', route: '/store/provinces', access: 'signed' },
  { method: 'GET', route: '/store/provinces/code/:code', access: 'signed' },
];

/** The key a declared handler and a registry entry are compared by. */
export const routeKey = (entry: Pick<GeoRouteEntry, 'method' | 'route'>): string => `${entry.method} ${entry.route}`;
