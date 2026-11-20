import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IMPORT_CONTENT_TYPE_OF_FORMAT, type ImportFormat } from '@cod/shared';
import type { ObjectStorage } from '../../application/ports/object-storage.port';
import { OBJECT_STORAGE } from '../../application/tokens';
import type { ObjectKey } from '../../domain/object-keys';
import { IMPORT_FIELDS, PREVIEW_FIELDS } from './endpoint-registry';
import { keyOfLink } from './export-kit';
import type { ImportSuite } from './import-kit';

const POLL_MS = 100;
const JOB_DEADLINE_MS = 120_000;
const FIXTURES = join(__dirname, '..', 'fixtures');

/** An import as the GraphQL tests read it. */
export interface ImportResultView {
  readonly importId: string;
  readonly status: string;
  readonly rowCount: number;
  readonly progress: number;
  readonly headerRow: number | null;
  readonly columns: { column: number; header: string; field: string | null; warning: string | null }[];
  readonly summary: { creates: number; updates: number; errors: number; warnings: number } | null;
  readonly result: { created: number; updated: number; failed: number } | null;
  readonly errorCode: string | null;
  readonly errorReportUrl: string | null;
}

/** A preview page as the GraphQL tests read it. */
export interface PreviewView {
  readonly totalItems: number;
  readonly items: {
    rowNumber: number;
    action: string;
    productKey: string | null;
    name: string | null;
    messages: string[];
  }[];
  readonly summary: { creates: number; updates: number; errors: number; warnings: number } | null;
}

/** How a test uploads: the format, and what the "browser" puts (bytes, content type) versus what it declared. */
export interface UploadSpec {
  readonly format: ImportFormat;
  readonly bytes: Uint8Array;
  readonly declaredSize?: number;
  readonly putContentType?: string;
}

const UPLOAD = `mutation ($input: CatalogImportUploadInput!) {
  createCatalogImportUpload(input: $input) { importId uploadUrl method headers { name value } expiresAt }
}`;
const ANALYZE = `mutation ($input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: $input) { ${IMPORT_FIELDS} } }`;
const PREVIEW = `mutation ($id: String!, $input: CatalogImportPreviewInput) {
  previewCatalogImport(id: $id, input: $input) { ${PREVIEW_FIELDS} }
}`;
const PAGE = `query ($id: String!, $skip: Int, $take: Int) {
  catalogImportPreview(id: $id, skip: $skip, take: $take) { ${PREVIEW_FIELDS} }
}`;
const CONFIRM = `mutation ($id: String!) { confirmCatalogImport(id: $id) { ${IMPORT_FIELDS} } }`;
const STATUS = `query ($id: String!) { catalogImport(id: $id) { ${IMPORT_FIELDS} } }`;

/** A committed fixture file of `tests/fixtures`. */
export const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

/** A CSV of `rows` (comma-separated, CRLF, no quoting needed by the tests' cells). */
export const csvOf = (rows: readonly (readonly string[])[]): Uint8Array =>
  new TextEncoder().encode(rows.map((row) => row.join(',')).join('\r\n'));

/** The import calls an integration file shares, on one suite, as whoever is signed in. */
export function importClient(suite: ImportSuite) {
  const storage = (): ObjectStorage => suite.kit.app.get<ObjectStorage>(OBJECT_STORAGE);
  const status = async (id: string): Promise<ImportResultView> =>
    (await suite.kit.gql<{ catalogImport: ImportResultView }>(STATUS, { id })).catalogImport;
  return {
    storage,
    status,
    /** Starts an upload and puts the bytes where the presigned PUT points, as the browser would. */
    upload: async (spec: UploadSpec): Promise<{ importId: string; key: ObjectKey }> => {
      const contentType = IMPORT_CONTENT_TYPE_OF_FORMAT[spec.format];
      const input = { format: spec.format, size: spec.declaredSize ?? spec.bytes.length, contentType };
      const { createCatalogImportUpload: started } = await suite.kit.gql<{
        createCatalogImportUpload: { importId: string; uploadUrl: string };
      }>(UPLOAD, { input });
      const key = keyOfLink(started.uploadUrl);
      await storage().write(key, spec.bytes, spec.putContentType ?? contentType);
      return { importId: started.importId, key };
    },
    analyze: async (importId: string): Promise<ImportResultView> =>
      (await suite.kit.gql<{ analyzeCatalogImport: ImportResultView }>(ANALYZE, { input: { importId } }))
        .analyzeCatalogImport,
    preview: async (importId: string, mapping?: readonly unknown[]): Promise<PreviewView> =>
      (
        await suite.kit.gql<{ previewCatalogImport: PreviewView }>(PREVIEW, {
          id: importId,
          ...(mapping === undefined ? {} : { input: { mapping } }),
        })
      ).previewCatalogImport,
    page: async (importId: string, skip: number, take: number): Promise<PreviewView> =>
      (await suite.kit.gql<{ catalogImportPreview: PreviewView }>(PAGE, { id: importId, skip, take }))
        .catalogImportPreview,
    confirm: async (importId: string): Promise<ImportResultView> =>
      (await suite.kit.gql<{ confirmCatalogImport: ImportResultView }>(CONFIRM, { id: importId })).confirmCatalogImport,
    /** Polls the import until it is done or failed. */
    settled: async (importId: string): Promise<ImportResultView> => {
      const deadline = Date.now() + JOB_DEADLINE_MS;
      for (;;) {
        const current = await status(importId);
        if (current.status === 'done' || current.status === 'failed') return current;
        if (Date.now() > deadline) throw new Error(`import ${importId} still ${current.status}`);
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    },
  };
}

/** The import calls of {@link importClient}. */
export type ImportClient = ReturnType<typeof importClient>;

/** Uploads, analyzes and previews `spec`; answers the import id and its first preview page. */
export async function previewed(
  client: ImportClient,
  spec: UploadSpec,
): Promise<{ importId: string; preview: PreviewView }> {
  const { importId } = await client.upload(spec);
  await client.analyze(importId);
  return { importId, preview: await client.preview(importId) };
}

/** How many products the signed-in caller's store holds. */
export async function productCount(suite: ImportSuite): Promise<number> {
  const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { totalItems: number } }>(
    'query { catalogProducts(options: { tab: "all", take: 1 }) { totalItems } }',
  );
  return catalogProducts.totalItems;
}
