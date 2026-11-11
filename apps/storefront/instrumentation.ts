import { isNextBuildPhase } from './cache/cache-config';

/**
 * Runs once when the server starts, before it serves a request: validates the environment and exits on an
 * invalid one (see {@link failFastOnInvalidEnv}). `next build` loads this file too and builds without a Valkey
 * URL or an API, so the check is skipped there: the build needs `NEXT_DEPLOYMENT_ID` only, which
 * `next.config.ts` requires.
 */
export async function register(): Promise<void> {
  // The literal `process.env.NEXT_RUNTIME` comparison is what Next replaces at build time, so the edge
  // bundle drops the Node-only import below.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || isNextBuildPhase(process.env)) return;
  const { failFastOnInvalidEnv } = await import('./src/boot/fail-fast-env');
  failFastOnInvalidEnv(process.env);
}
