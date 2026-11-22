import { isIP } from 'node:net';

/** The buyer address Cloudflare sets and overwrites on every request; a client cannot forge it behind the edge. */
export const EDGE_CLIENT_IP_HEADER = 'cf-connecting-ip';

/**
 * The buyer's address for the api's rate limit (D3213): `CF-Connecting-IP`, only when the storefront runs behind
 * Cloudflare (`STOREFRONT_TRUST_EDGE_IP=true`) and the value is one IP address. Otherwise none: the api then keys a
 * catalog read by the signing kid and store. `X-Forwarded-For` is never read. The header is believed from any
 * caller, so the trust is only safe when the origin is reachable through Cloudflare alone (Tunnel, authenticated
 * origin pulls, or a firewall allow-list of Cloudflare's ranges; P3.S5): otherwise a forged value per request gets
 * a fresh per-buyer bucket.
 */
export function clientIpOf(headers: Pick<Headers, 'get'>, trustEdge: boolean): string | undefined {
  if (!trustEdge) return undefined;
  return validIp(headers.get(EDGE_CLIENT_IP_HEADER) ?? '');
}

/**
 * The query parameter the proxy uses to hand the buyer address to the per-request search page, which may not read
 * request headers (ADR 0006). The proxy always removes a client-sent value first and sets it only on uncached pages.
 */
export const BUYER_IP_QUERY_PARAM = 'cod_buyer_ip';

/** The buyer address the proxy put in a page query, or none when it is missing or not one IP address. */
export function buyerIpOfQuery(
  raw: Readonly<Record<string, string | readonly string[] | undefined>>,
): string | undefined {
  const value = raw[BUYER_IP_QUERY_PARAM];
  return validIp(typeof value === 'string' ? value : (value?.[0] ?? ''));
}

function validIp(value: string): string | undefined {
  const candidate = value.trim();
  return isIP(candidate) === 0 ? undefined : candidate;
}
