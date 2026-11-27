import { TENANT_ROUTE_SEGMENT } from '@cod/shared';

/** Where the proxy rewrites a store's requests: `/_t/{locale}/{storeId}/{binding}{path}` (the `app/%5Ft` folder). */
export const TENANT_PATH_PREFIX = `/${TENANT_ROUTE_SEGMENT}`;

/**
 * Where the proxy rewrites requests that must answer 404. No route serves it on purpose: Next's own not-found route
 * then renders `app/not-found.tsx` on the server with status 404. (A page calling `notFound()` streams under Cache
 * Components, so it answers status 200 with the not-found UI and a `noindex` tag: a soft 404, used only for crafted
 * tenant paths and unknown slugs, D3202.)
 */
export const NOT_FOUND_PATH = '/_404';

/**
 * `/_t`, `/_404`, `/_internal` and `/api/internal`, in any letter case, once the path has been decoded. The
 * `api/` prefix never reaches the proxy in its own case (the matcher skips it); the edge blocks `/api/internal`
 * too and the revalidate route checks its HMAC (D3211).
 */
const INTERNAL_PATH = /^\/(?:_(?:t|404|internal)|api\/internal)(?:\/|$)/i;

/** How many times a path is percent-decoded before the check: `%255f` is `%5f` once and `_` twice. */
const DECODE_ROUNDS = 3;

/** The path decoded `DECODE_ROUNDS` times with repeated slashes collapsed, or `null` for a malformed sequence. */
function decodedForms(pathname: string): string[] | null {
  const forms = [pathname];
  let current = pathname;
  for (let round = 0; round < DECODE_ROUNDS; round += 1) {
    try {
      current = decodeURIComponent(current);
    } catch (error) {
      // A malformed `%` sequence is refused like an internal path (404), never answered with a 500.
      if (error instanceof URIError) return null;
      throw error;
    }
    forms.push(current);
  }
  return forms.map((form) => form.replace(/\/{2,}/g, '/'));
}

/**
 * Whether a public request must be refused: it targets an internal path, raw or percent-encoded up to three
 * times, or holds a malformed percent sequence.
 */
export function isInternalPath(pathname: string): boolean {
  const forms = decodedForms(pathname);
  if (forms === null) return true;
  return forms.some((form) => INTERNAL_PATH.test(form));
}
