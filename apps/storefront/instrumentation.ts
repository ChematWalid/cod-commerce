import { isNextBuildPhase } from './cache/cache-config';

/**
 * Runs once when the server starts, before it serves a request: checks the cache configuration and exits on
 * an invalid one (see {@link failFastOnInvalidCacheConfig}). `next build` loads this file too and builds
 * without a Valkey URL, so the check is skipped there; the proxy's edge runtime needs no cache.
 */
export async function register(): Promise<void> {
  // The literal `process.env.NEXT_RUNTIME` comparison is what Next replaces at build time, so the edge
  // bundle drops the Node-only import below.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || isNextBuildPhase(process.env)) return;
  const { failFastOnInvalidCacheConfig } = await import('./src/boot/fail-fast-cache-config');
  failFastOnInvalidCacheConfig(process.env);
}
