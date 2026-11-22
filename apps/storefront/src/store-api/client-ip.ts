import { isIP } from 'node:net';

/** The buyer address Cloudflare sets and overwrites on every request; a client cannot forge it behind the edge. */
export const EDGE_CLIENT_IP_HEADER = 'cf-connecting-ip';

/**
 * The buyer's address for the api's rate limit (D3213): `CF-Connecting-IP`, only when the storefront runs behind
 * Cloudflare (`STOREFRONT_TRUST_EDGE_IP=true`) and the value is one IP address. Otherwise none: the api then keys the
 * call by the signing kid. `X-Forwarded-For` is never read.
 */
export function clientIpOf(headers: Headers, trustEdge: boolean): string | undefined {
  if (!trustEdge) return undefined;
  const value = headers.get(EDGE_CLIENT_IP_HEADER)?.trim() ?? '';
  return isIP(value) === 0 ? undefined : value;
}
