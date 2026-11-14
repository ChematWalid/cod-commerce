import type { CatalogKit } from './catalog-kit';
import type { OperationEntry } from './registry-calls';

/** A file as a client sends it: its bytes and the type and name it claims. */
export interface UploadedFile {
  readonly bytes: Buffer;
  readonly claimedType: string;
  readonly name: string;
}

/** One GraphQL error as the server answers it. */
interface GraphqlError {
  readonly message: string;
  readonly extensions?: { readonly code?: string; readonly retryAfterSeconds?: number };
}

/** A multipart answer: its data, its first error code (none on success) and its text. */
export interface UploadAnswer {
  readonly data: Record<string, unknown> | null;
  readonly code: string | undefined;
  readonly text: string;
}

/** A media item as the tests read it. */
export interface MediaResult {
  readonly id: string;
  readonly assetId: string;
  readonly url: string;
  readonly previewUrl: string;
  readonly mimeType: string;
}

export const MEDIA_FIELDS = 'id assetId url previewUrl mimeType width height fileSize createdAt';
export const UPLOAD = `mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { ${MEDIA_FIELDS} } }`;
export const MEDIA = `query ($options: CatalogMediaListInput) {
  catalogMedia(options: $options) { totalItems items { ${MEDIA_FIELDS} } }
}`;
export const DELETE_MEDIA = 'mutation ($id: String!) { deleteCatalogMedia(id: $id) }';

/** A 1x1 PNG, the smallest real image the asset pipeline can make a preview of. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** A real PNG, under whatever type and name a client chooses. */
export const png = (claimedType = 'image/png', name = 'photo.png'): UploadedFile => ({
  bytes: PNG_1X1,
  claimedType,
  name,
});

/** What the test client sends with every call: its session and the active channel. */
interface ClientInternals {
  readonly apiUrl: string;
  readonly headers: Record<string, string>;
}

/** A GraphQL multipart request (`graphql-multipart-request-spec`) with one file at `variables.file`. */
export async function uploadAs(kit: CatalogKit, file: UploadedFile, query = UPLOAD): Promise<UploadAnswer> {
  const { apiUrl, headers } = kit.client as unknown as ClientInternals;
  const form = new FormData();
  form.set('operations', JSON.stringify({ query, variables: { file: null } }));
  form.set('map', JSON.stringify({ '0': ['variables.file'] }));
  form.set('0', new Blob([file.bytes], { type: file.claimedType }), file.name);
  const response = await fetch(apiUrl, { method: 'POST', headers: { ...headers }, body: form });
  const text = await response.text();
  const body = JSON.parse(text) as { data?: Record<string, unknown> | null; errors?: GraphqlError[] };
  return { data: body.data ?? null, code: body.errors?.[0]?.extensions?.code, text };
}

/** Uploads a PNG as the signed-in caller in its active store and returns the media item. */
export async function createMedia(kit: CatalogKit, file: UploadedFile = png()): Promise<MediaResult> {
  const answer = await uploadAs(kit, file);
  const media = answer.data?.['uploadCatalogMedia'] as MediaResult | undefined;
  if (media === undefined) throw new Error(`Upload failed: ${answer.code ?? 'no code'}`);
  return media;
}

/** Calls a registry entry as a multipart upload; the entry's document takes the file at `variables.file`. */
export function uploadEntry(kit: CatalogKit, entry: OperationEntry): Promise<UploadAnswer> {
  return uploadAs(kit, png(), entry.document);
}
