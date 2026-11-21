import type { ObjectStorage } from '../../application/ports/object-storage.port';
import { OBJECT_STORAGE } from '../../application/tokens';
import type { ObjectKey } from '../../domain/object-keys';
import { EXPORT_FIELDS } from './endpoint-registry';
import type { ImportSuite } from './import-kit';

const MEMORY_SCHEME = 'memory://';
const POLL_MS = 100;
const JOB_DEADLINE_MS = 120_000;

/** An export as the GraphQL tests read it. */
export interface ExportResult {
  readonly exportId: string;
  readonly status: string;
  readonly progress: number;
  readonly rowCount: number;
  readonly skippedPacks: number;
  readonly errorCode: string | null;
  readonly downloadUrl: string | null;
}

const EXPORT = `mutation ($input: CatalogExportInput!) { exportCatalogProducts(input: $input) { ${EXPORT_FIELDS} } }`;
const STATUS = `query ($id: String!) { catalogExport(id: $id) { ${EXPORT_FIELDS} } }`;

/** The object key a `memory://` download link names (D2208). */
export function keyOfLink(downloadUrl: string): ObjectKey {
  if (!downloadUrl.startsWith(MEMORY_SCHEME)) throw new Error(`not a memory link: ${downloadUrl}`);
  return decodeURIComponent(downloadUrl.slice(MEMORY_SCHEME.length).split('?')[0] ?? '') as ObjectKey;
}

/** The query parameters a `memory://` download link signed. */
export const signedParamsOf = (downloadUrl: string): URLSearchParams =>
  new URLSearchParams(downloadUrl.split('?')[1] ?? '');

/** The export calls and reads the export integration file shares, on one suite. */
export interface ExportClient {
  readonly exportProducts: (input: Record<string, unknown>) => Promise<ExportResult>;
  readonly status: (id: string) => Promise<ExportResult>;
  /** The bytes behind a download link, read through the server's own storage (nothing serves `memory://`). */
  readonly fileOf: (downloadUrl: string) => Promise<Uint8Array>;
  /** Polls the export until it is done or failed. */
  readonly settled: (id: string) => Promise<ExportResult>;
}

/** {@link ExportClient} over the suite's GraphQL client, as whoever is signed in. */
export function exportClient(suite: ImportSuite): ExportClient {
  const status = async (id: string): Promise<ExportResult> =>
    (await suite.kit.gql<{ catalogExport: ExportResult }>(STATUS, { id })).catalogExport;
  return {
    exportProducts: async (input) =>
      (await suite.kit.gql<{ exportCatalogProducts: ExportResult }>(EXPORT, { input })).exportCatalogProducts,
    status,
    fileOf: async (downloadUrl) => {
      const key = keyOfLink(downloadUrl);
      const storage = suite.kit.app.get<ObjectStorage>(OBJECT_STORAGE);
      const head = await storage.head(key);
      if (head === null) throw new Error(`no object at ${key}`);
      return storage.read(key, { maxBytes: head.size, ifMatch: head.etag });
    },
    settled: async (id) => {
      const deadline = Date.now() + JOB_DEADLINE_MS;
      for (;;) {
        const current = await status(id);
        if (current.status === 'done' || current.status === 'failed') return current;
        if (Date.now() > deadline) throw new Error(`export ${id} still ${current.status}`);
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    },
  };
}

/** The text of a CSV export without its byte order mark. */
export const csvText = (bytes: Uint8Array): string => new TextDecoder('utf-8').decode(bytes);
