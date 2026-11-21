/** The private bucket on Garage (D2208): an internal endpoint for the server, a public one only to sign. */
export interface S3StorageOptions {
  readonly kind: 's3';
  readonly endpoint: string;
  /** What a browser reaches (`S3_PUBLIC_ENDPOINT`, blank = `S3_ENDPOINT`); only signs presigned URLs. */
  readonly publicEndpoint: string;
  readonly region: string;
  readonly forcePathStyle: boolean;
  /** `S3_BUCKET_PRIVATE`. */
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/** Objects in memory, for the integration and e2e suites only (D2208). */
export interface MemoryStorageOptions {
  readonly kind: 'memory';
}

/** How a link import fetches a page: the SSRF-guarded HTTP scraper, or synthetic pages for tests (D2214). */
export type LinkScraperKind = 'http' | 'fixture';

/** How the server configures `CatalogImportPlugin` (from `S3_*`, `S3_PUBLIC_ENDPOINT`, `LINK_IMPORT_SCRAPER`). */
export interface CatalogImportPluginOptions {
  readonly objectStorage: S3StorageOptions | MemoryStorageOptions;
  readonly linkScraper: LinkScraperKind;
  /** `APP_ENV`: production refuses the memory storage and the fixture scraper. */
  readonly appEnv: string;
}

const PRODUCTION = 'production';
let current: CatalogImportPluginOptions | undefined;

/**
 * Validates and keeps the options. A later call replaces them, so a test config can re-call `init` after the app's
 * own (D2208); providers read them lazily, when the app is built.
 * @throws Error for the memory storage or the fixture scraper in production
 */
export function setCatalogImportOptions(options: CatalogImportPluginOptions): void {
  if (options.appEnv === PRODUCTION && options.objectStorage.kind === 'memory') {
    throw new Error('CatalogImportPlugin refuses the memory object storage when APP_ENV is production');
  }
  if (options.appEnv === PRODUCTION && options.linkScraper === 'fixture') {
    throw new Error('CatalogImportPlugin refuses the fixture link scraper when APP_ENV is production');
  }
  current = options;
}

/**
 * The options the last `init` set.
 * @throws Error when the plugin is registered without `CatalogImportPlugin.init(...)`
 */
export function requireCatalogImportOptions(): CatalogImportPluginOptions {
  if (current === undefined) {
    throw new Error('CatalogImportPlugin is registered without options: use CatalogImportPlugin.init(...)');
  }
  return current;
}

/** The options the last `init` set, or undefined before any. */
export function currentCatalogImportOptions(): CatalogImportPluginOptions | undefined {
  return current;
}

/** Forgets the options (unit tests). */
export function clearCatalogImportOptions(): void {
  current = undefined;
}
