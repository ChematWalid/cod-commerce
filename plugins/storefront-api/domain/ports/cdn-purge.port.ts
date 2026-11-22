/**
 * The CDN in front of the storefront (D3210): purges every cached response of some hostnames. The only adapter now
 * logs; the Cloudflare one needs the owner's API token (P3.S5).
 */
export interface CdnPurgePort {
  /** Purges `hostnames` (at most `PURGE_MAX_HOSTNAMES`) in one request. */
  purgeHosts(hostnames: readonly string[]): Promise<void>;
}
