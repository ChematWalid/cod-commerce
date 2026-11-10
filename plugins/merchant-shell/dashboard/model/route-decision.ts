/** The layout route every signed-in page sits under; a route id is this prefix plus the page's path. */
const AUTHENTICATED_LAYOUT_ID = '/_authenticated';

/** The route id of the dashboard root: `fullPath` is `/` for it and for an unknown URL, the route id is not. */
const ROOT_ROUTE_ID = `${AUTHENTICATED_LAYOUT_ID}/`;

/** The stock profile page, which merchants reach as the account profile. */
const STOCK_PROFILE_ROUTE_ID = `${AUTHENTICATED_LAYOUT_ID}/_profile/profile`;

const HOME_PATH = '/home';
const ACCOUNT_PROFILE_PATH = '/account/profile';

/**
 * The stock routes a merchant may open: none (D84). A session that reuses a stock page adds its route id here, as an
 * allow-list like the server's D59.
 */
export const MERCHANT_ALLOWED_STOCK_ROUTES: readonly string[] = [];

/** What the route guard does for a merchant. */
export type MerchantRouteDecision = 'render' | { readonly redirect: string } | 'not-found';

/**
 * Decides on the last match's `routeId`: the root goes to Home, the stock profile to the account profile, an
 * extension route (`/_authenticated` + one of `extensionPaths`) or an allowed stock route renders, and everything
 * else, an unknown URL included, is not found. Presentation only: the server enforces access.
 */
export function decideMerchantRoute(
  routeId: string,
  extensionPaths: readonly string[],
  allowedStock: readonly string[],
): MerchantRouteDecision {
  if (routeId === ROOT_ROUTE_ID) {
    return { redirect: HOME_PATH };
  }
  if (routeId === STOCK_PROFILE_ROUTE_ID) {
    return { redirect: ACCOUNT_PROFILE_PATH };
  }
  const isExtension = extensionPaths.some((path) => routeId === `${AUTHENTICATED_LAYOUT_ID}${path}`);
  return isExtension || allowedStock.includes(routeId) ? 'render' : 'not-found';
}
