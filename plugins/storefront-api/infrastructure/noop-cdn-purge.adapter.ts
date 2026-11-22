import { Logger } from '@vendure/core';
import type { CdnPurgePort } from '../domain/ports/cdn-purge.port';

const LOG_CONTEXT = 'StorefrontCdnPurge';

/**
 * {@link CdnPurgePort} until the owner provides a Cloudflare API token (D3210, P3.S5 checklist): logs the purge it
 * would send. Pages still leave the CDN within 60 s (`Cloudflare-CDN-Cache-Control: max-age=60`).
 */
export class NoopCdnPurge implements CdnPurgePort {
  purgeHosts(hostnames: readonly string[]): Promise<void> {
    Logger.verbose(`CDN purge skipped (no CDN adapter): ${String(hostnames.length)} hostname(s)`, LOG_CONTEXT);
    return Promise.resolve();
  }
}
