/** Where the proxy rewrites a store's requests: `/_t/{storeId}/{locale}{path}` (the `app/%5Ft` folder). */
export const TENANT_PATH_PREFIX = '/_t';

/**
 * Where the proxy rewrites requests that must answer 404. No route serves it on purpose: Next's own
 * not-found route then renders `app/not-found.tsx` on the server with status 404. (A page calling
 * `notFound()` is prerendered under Cache Components as an error shell whose markup renders only in the
 * browser.)
 */
export const NOT_FOUND_PATH = '/_404';

/** `/_t`, `/_404` and `/_internal`, raw or with an encoded underscore, in any letter case. */
const INTERNAL_PATH = /^\/(?:_|%5f)(?:t|404|internal)(?:\/|$)/i;

/** Whether a public request targets an internal path, which must never be reachable from outside. */
export function isInternalPath(pathname: string): boolean {
  return INTERNAL_PATH.test(pathname);
}
