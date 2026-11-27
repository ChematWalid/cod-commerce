/** The storefront origin when none is given: the local `pnpm dev` storefront. */
const DEFAULT_ORIGIN = 'http://127.0.0.1:3000';
/** The store host when none is given: the demo store of the demo seed (`*.localhost`). */
const DEFAULT_STORE_HOST = 'demo.localhost';

/** Scheme, host and optional port, nothing after: requests append their own path. */
const ORIGIN_FORMAT = /^https?:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?$/;
/** A bare host name with an optional port: it goes in the `Host` header as is. */
const HOST_FORMAT = /^[A-Za-z0-9.-]+(:[0-9]{1,5})?$/;

/**
 * Where a k6 run sends its requests: `ORIGIN` is the storefront reached directly (a node, or the local compose
 * port), `STORE_HOST` the store host sent as `Host`, so the storefront resolves the store exactly as it does
 * behind the edge without DNS for the store host.
 *
 * @param {Readonly<Record<string, string | undefined>>} env the k6 `__ENV`
 * @returns {{ origin: string, host: string }}
 * @throws {Error} when `ORIGIN` is not `http(s)://host[:port]` or `STORE_HOST` is not a bare host
 */
export function storeTargetOf(env) {
  const origin = env.ORIGIN ?? DEFAULT_ORIGIN;
  const host = env.STORE_HOST ?? DEFAULT_STORE_HOST;
  if (!ORIGIN_FORMAT.test(origin)) throw new Error(`ORIGIN must be http(s)://host[:port], got '${origin}'`);
  if (!HOST_FORMAT.test(host)) throw new Error(`STORE_HOST must be a bare host name, got '${host}'`);
  return { origin, host };
}
