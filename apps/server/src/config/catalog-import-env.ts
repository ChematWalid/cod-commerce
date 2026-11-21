import type { LinkScraperKind } from '@cod/plugin-catalog-import';
import { z } from 'zod';

/** The scrapers `LINK_IMPORT_SCRAPER` accepts; the plugin gives them their meaning (D2214). */
const LINK_SCRAPERS = ['http', 'fixture'] as const satisfies readonly LinkScraperKind[];
const PRODUCTION = 'production';
const HTTPS_PROTOCOL = 'https:';

/** The variables of the catalog-import plugin, spread into the server's schema (D2208, D2214). */
export const catalogImportEnvShape = {
  // What a browser reaches the private bucket on: presigned uploads and downloads are signed for it. Blank or unset
  // falls back to S3_ENDPOINT (the compose network's `garage:3900` is not reachable from a browser).
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  // `fixture` serves synthetic pages to the link import for tests and evidence; refused in production.
  LINK_IMPORT_SCRAPER: z.enum(LINK_SCRAPERS).default('http'),
};

/** The parts of the environment the catalog-import checks read. */
interface CatalogImportEnv {
  readonly APP_ENV: string;
  readonly S3_ENDPOINT: string;
  readonly S3_PUBLIC_ENDPOINT?: string | undefined;
  readonly LINK_IMPORT_SCRAPER: LinkScraperKind;
}

const isHttps = (url: string): boolean => URL.canParse(url) && new URL(url).protocol === HTTPS_PROTOCOL;

/**
 * A production server signs only https links and never serves fixture pages as products. The link host checked is
 * the one signed for, after the fallback: an unset `S3_PUBLIC_ENDPOINT` with the internal http `S3_ENDPOINT` fails
 * boot instead of signing links no browser can reach (D2252).
 */
export function requireCatalogImportSettings(env: CatalogImportEnv, context: z.RefinementCtx): void {
  if (env.APP_ENV !== PRODUCTION) return;
  const explicit = env.S3_PUBLIC_ENDPOINT;
  if (explicit !== undefined && !URL.canParse(explicit)) return; // the URL rule reports it
  if (!isHttps(explicit ?? env.S3_ENDPOINT)) {
    context.addIssue({
      code: 'custom',
      path: ['S3_PUBLIC_ENDPOINT'],
      message:
        explicit === undefined
          ? 'is required in production unless S3_ENDPOINT is an https:// URL a browser reaches'
          : 'must be an https:// URL in production',
    });
  }
  if (env.LINK_IMPORT_SCRAPER === 'fixture') {
    context.addIssue({ code: 'custom', path: ['LINK_IMPORT_SCRAPER'], message: 'must not be fixture in production' });
  }
}

/** `S3_PUBLIC_ENDPOINT`, or `S3_ENDPOINT` when it is unset. */
export const catalogImportDefaults = (env: CatalogImportEnv): { S3_PUBLIC_ENDPOINT: string } => ({
  S3_PUBLIC_ENDPOINT: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
});
