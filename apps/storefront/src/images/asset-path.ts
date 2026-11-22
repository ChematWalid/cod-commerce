/** The route the api's asset server answers on (`apps/server` `ASSET_ROUTE`); absolute previews carry it. */
const ASSET_ROUTE_PREFIX = '/assets/';

/** A URL scheme at the start of a value (`https:`, `javascript:`): the value is a URL, not a storage path. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const ALLOWED_URL_PROTOCOLS: readonly string[] = ['http:', 'https:'];

/** A path that walks up (`..`) or stays (`.`) could leave the asset route once joined to the asset base. */
function hasDotSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '.' || segment === '..');
}

/** A percent-encoded path decoded, or null when it is not valid UTF-8: such a URL names no stored image. */
function decodedOrNull(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    if (error instanceof URIError) return null;
    throw error;
  }
}

/** The storage path inside an absolute asset server URL, or null for any other URL. */
function pathOfAssetUrl(value: string): string | null {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  if (!ALLOWED_URL_PROTOCOLS.includes(url.protocol)) return null;
  if (!url.pathname.startsWith(ASSET_ROUTE_PREFIX)) return null;
  return decodedOrNull(url.pathname.slice(ASSET_ROUTE_PREFIX.length));
}

/** A relative value: the path itself, without the asset route when it starts with it. */
function pathOfRelative(value: string): string {
  return value.startsWith(ASSET_ROUTE_PREFIX) ? value.slice(ASSET_ROUTE_PREFIX.length) : value.replace(/^\/+/, '');
}

/**
 * One image shape for every api image: a storage path the image loader turns into a URL (D3209). Product previews
 * already are storage paths; collection previews come back as absolute asset server URLs (D3217 b), whose path below
 * `/assets/` is that same storage path. Anything else (another scheme, another route, a dot segment) is no image.
 */
export function toAssetPath(value: string | null): string | null {
  if (value === null || value === '') return null;
  const path = URL_SCHEME.test(value) ? pathOfAssetUrl(value) : pathOfRelative(value);
  if (path === null || path === '' || hasDotSegment(path)) return null;
  return path;
}
