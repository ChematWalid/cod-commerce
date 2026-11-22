import type { StorefrontStore } from '@cod/shared';

/** Development stores live on `*.localhost`, served over plain http; every other store is https behind the edge. */
const LOCAL_HOST = 'localhost';

function originOf(store: StorefrontStore): string {
  const host = store.primaryHost;
  const isLocal = host === LOCAL_HOST || host.endsWith(`.${LOCAL_HOST}`);
  return `${isLocal ? 'http' : 'https'}://${host}`;
}

/**
 * The canonical URL of a buyer path on the store's primary host: from the store record alone, never from the
 * request's headers (ADR 0006), so a cached page or sitemap names the same URL whichever host asked.
 */
export function canonicalUrl(store: StorefrontStore, path: string): string {
  return `${originOf(store)}${path === '/' ? '' : path}`;
}
