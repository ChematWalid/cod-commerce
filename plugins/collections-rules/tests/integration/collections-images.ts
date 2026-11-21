import { CREATE_COLLECTION, type GraphqlErrorShape, UPDATE_COLLECTION } from './collections-api';
import type { CollectionsKit } from './collections-kit';

/** The catalog media upload (D2320: the collection editor picks its image through catalog's media ops). */
const UPLOAD = 'mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { assetId } }';

/** A 1x1 PNG, the smallest real image the asset pipeline can make a preview of. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** What the test client sends with every call: its session and the active channel. */
interface ClientInternals {
  readonly apiUrl: string;
  readonly headers: Record<string, string>;
}

interface UploadBody {
  readonly data?: { readonly uploadCatalogMedia?: { readonly assetId: string } } | null;
}

/**
 * Uploads a PNG as the signed-in caller into its active store (a GraphQL multipart request) and returns the asset id
 * as the Admin API encodes it.
 */
export async function uploadImage(kit: CollectionsKit): Promise<string> {
  const { apiUrl, headers } = kit.client as unknown as ClientInternals;
  const form = new FormData();
  form.set('operations', JSON.stringify({ query: UPLOAD, variables: { file: null } }));
  form.set('map', JSON.stringify({ '0': ['variables.file'] }));
  form.set('0', new Blob([PNG_1X1], { type: 'image/png' }), 'collection.png');
  const response = await fetch(apiUrl, { method: 'POST', headers: { ...headers }, body: form });
  const text = await response.text();
  const assetId = (JSON.parse(text) as UploadBody).data?.uploadCatalogMedia?.assetId;
  if (assetId === undefined) throw new Error(`Upload failed: ${text.slice(0, 200)}`);
  return assetId;
}

/** What a collection write naming an image answered: its error code (none on success) and its text. */
export interface ImageOutcome {
  readonly code: string | undefined;
  readonly text: string;
}

async function viaGraphql(
  kit: CollectionsKit,
  document: string,
  variables: Record<string, unknown>,
): Promise<ImageOutcome> {
  try {
    return { code: undefined, text: JSON.stringify(await kit.gql(document, variables)) };
  } catch (error: unknown) {
    const { response } = error as GraphqlErrorShape;
    return { code: response?.errors?.[0]?.extensions?.code, text: JSON.stringify(response ?? null) };
  }
}

/** A REST answer's code; a refusal that is not 404 shows as its status, so a wrong status cannot pass. */
async function viaRest(
  kit: CollectionsKit,
  method: 'POST' | 'PATCH',
  url: string,
  body: unknown,
): Promise<ImageOutcome> {
  const answer = await kit.rest(method, url, body);
  if (answer.status < 400) return { code: undefined, text: answer.text };
  const code =
    answer.status === 404 ? (answer.body as { code?: string } | null)?.code : `HTTP ${String(answer.status)}`;
  return { code, text: answer.text };
}

/** A new manual collection of the active store showing `featuredAssetId`. */
const newCollection = (slug: string, featuredAssetId: string): Record<string, unknown> => ({
  title: 'Borrowed image',
  slug,
  visible: true,
  position: 0,
  mode: 'manual',
  featuredAssetId,
});

/** The engine id behind an encoded GraphQL id (`T_12` → `12`); a malformed id stays as it is. */
const engineId = (id: string): string => id.replace(/^T_/, '');

/**
 * A collection write naming an image: `target` is the collection an update edits, `assetId` the image as GraphQL
 * encodes it (REST sends the engine id), `slug` the slug a create uses.
 */
export type ImageCall = (
  kit: CollectionsKit,
  target: { readonly id: string },
  assetId: string,
  slug: string,
) => Promise<ImageOutcome>;

/** Every collection write that takes an image id, over both API surfaces. */
export const IMAGE_CALLS: readonly (readonly [string, ImageCall])[] = [
  [
    'createStoreCollection',
    (kit, _target, assetId, slug) => viaGraphql(kit, CREATE_COLLECTION, { input: newCollection(slug, assetId) }),
  ],
  [
    'updateStoreCollection',
    (kit, target, assetId) =>
      viaGraphql(kit, UPDATE_COLLECTION, { id: target.id, input: { featuredAssetId: assetId } }),
  ],
  [
    'POST /catalog/collections',
    (kit, _target, assetId, slug) =>
      viaRest(kit, 'POST', '/catalog/collections', newCollection(slug, engineId(assetId))),
  ],
  [
    'PATCH /catalog/collections/:id',
    (kit, target, assetId) =>
      viaRest(kit, 'PATCH', `/catalog/collections/${engineId(target.id)}`, { featuredAssetId: engineId(assetId) }),
  ],
];

/** How many collections of any store carry `slug`: a refused create leaves none. */
export async function collectionsWithSlug(kit: CollectionsKit, slug: string): Promise<number> {
  const rows = await kit.query<{ count: string }>(
    'SELECT count(*) AS count FROM collection_translation WHERE slug = $1',
    [slug],
  );
  return Number(rows[0]?.count ?? 0);
}
