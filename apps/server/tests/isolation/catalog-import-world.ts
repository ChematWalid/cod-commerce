import { catalogOf } from './catalog-world';
import { dataOf, type Exchange, fieldOf, type IsolationHttp } from './http';
import { ownChannel } from './matrix';
import { CREATE_CATALOG_PRODUCT } from './seed-operations';
import type { BusinessWorld } from './world-types';

/**
 * The pack, import, export and link rows (plugins/catalog-packs and plugins/catalog-import, P2.S2) of one business,
 * seeded through their Admin API as its owner on its first store; the spreadsheet's bytes go where the presigned PUT
 * points through the server's object storage, as the browser would (D2208). Every new tenant table gets a row: the
 * pack and its components, the import job with its preview rows, the export job, and the link import's job and origin.
 */
export interface CatalogImportWorld {
  /** A pack product saved with two components of the same store (GraphQL ids). */
  readonly pack: { readonly productId: string; readonly componentIds: readonly [string, string] };
  /** A spreadsheet import, previewed (its rows stored), and the key its file was put at. */
  readonly spreadsheet: { readonly importId: string; readonly uploadKey: string };
  /** A finished export of the catalog product. */
  readonly exportId: string;
  /** A link import of the fixture page and the Draft product it made (GraphQL id). */
  readonly link: { readonly importId: string; readonly productId: string };
}

/** Where the e2e test puts an upload's bytes: the server's private object storage (memory in the e2e boot). */
export interface UploadedObjects {
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

/** The rows of businesses A and B, filled by the controller with {@link seedCatalogImport}, like `CATALOG_WORLDS`. */
export const CATALOG_IMPORT_WORLDS = new Map<'A' | 'B', CatalogImportWorld>();

const SAVE_PACK = `mutation ($id: ID!, $input: CatalogPackInput!) { saveCatalogPack(productId: $id, input: $input) { productId } }`;
const UPLOAD = `mutation ($input: CatalogImportUploadInput!) { createCatalogImportUpload(input: $input) { importId uploadUrl } }`;
const ANALYZE = 'mutation ($input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: $input) { status } }';
const PREVIEW = 'mutation ($id: String!) { previewCatalogImport(id: $id) { totalItems } }';
const EXPORT = 'mutation ($input: CatalogExportInput!) { exportCatalogProducts(input: $input) { exportId status } }';
const LINK =
  'mutation ($input: CatalogLinkImportInput!) { createCatalogLinkImport(input: $input) { importId productId } }';
/** The fixture scraper's synthetic page (D2214): the e2e boot runs the fixture scraper. */
export const LINK_FIXTURE_URL = 'https://shop.example.test/products/kaftan';
const CSV_TYPE = 'text/csv';
const MEMORY_SCHEME = 'memory://';
const COMPONENT_PRICES = [1200, 800] as const;

/** The object key a `memory://` presigned link names (the e2e boot's object storage, D2208). */
export function keyOfMemoryLink(url: string): string {
  if (!url.startsWith(MEMORY_SCHEME)) throw new Error(`not a memory link: ${url}`);
  return decodeURIComponent(url.slice(MEMORY_SCHEME.length).split('?')[0] ?? '');
}

/** An Admin API call of `business`'s owner on its first store, answering `field`. */
async function ownerCall<T>(
  http: IsolationHttp,
  business: BusinessWorld,
  call: { query: string; variables: object; field: string },
) {
  const exchange = await http.graphql(business.owner, call.query, { ...call.variables }, ownChannel(business));
  return fieldOf(exchange, call.field) as T;
}

async function createProduct(http: IsolationHttp, business: BusinessWorld, input: Record<string, unknown>) {
  const created = await ownerCall<{ product: { id: string } }>(http, business, {
    query: CREATE_CATALOG_PRODUCT,
    variables: { input: { status: 'active', ...input } },
    field: 'createCatalogProduct',
  });
  return created.product.id;
}

async function seedPack(http: IsolationHttp, business: BusinessWorld): Promise<CatalogImportWorld['pack']> {
  const tag = `${business.label} ${business.businessId}`;
  const [firstPrice, secondPrice] = COMPONENT_PRICES;
  const componentIds = [
    await createProduct(http, business, { title: `Pack part 1 ${tag}`, price: firstPrice }),
    await createProduct(http, business, { title: `Pack part 2 ${tag}`, price: secondPrice }),
  ] as const;
  const productId = await createProduct(http, business, { title: `Pack ${tag}`, type: 'pack', price: 0 });
  const input = {
    packPricingMode: 'components_sum',
    packVariantMode: 'per_component',
    packWeightMode: 'components_sum',
    components: componentIds.map((id) => ({ productId: id, quantity: 1 })),
  };
  await ownerCall(http, business, { query: SAVE_PACK, variables: { id: productId, input }, field: 'saveCatalogPack' });
  return { productId, componentIds };
}

async function seedSpreadsheet(
  http: IsolationHttp,
  objects: UploadedObjects,
  business: BusinessWorld,
): Promise<CatalogImportWorld['spreadsheet']> {
  const bytes = new TextEncoder().encode(
    `product_key,name,price\r\nIMP-${business.label}-${business.businessId},Imported,10`,
  );
  const started = await ownerCall<{ importId: string; uploadUrl: string }>(http, business, {
    query: UPLOAD,
    variables: { input: { format: 'csv', size: bytes.length, contentType: CSV_TYPE } },
    field: 'createCatalogImportUpload',
  });
  const uploadKey = keyOfMemoryLink(started.uploadUrl);
  await objects.write(uploadKey, bytes, CSV_TYPE);
  const { importId } = started;
  await ownerCall(http, business, {
    query: ANALYZE,
    variables: { input: { importId } },
    field: 'analyzeCatalogImport',
  });
  await ownerCall(http, business, { query: PREVIEW, variables: { id: importId }, field: 'previewCatalogImport' });
  return { importId, uploadKey };
}

/**
 * Seeds `business`'s pack, spreadsheet import (previewed, not confirmed), export and link import. Runs after
 * `seedCatalog` (the export names its product).
 *
 * @throws Error when a call fails or the business has no catalog rows.
 */
export async function seedCatalogImport(
  http: IsolationHttp,
  objects: UploadedObjects,
  business: BusinessWorld,
): Promise<CatalogImportWorld> {
  const pack = await seedPack(http, business);
  const spreadsheet = await seedSpreadsheet(http, objects, business);
  const exported = await ownerCall<{ exportId: string }>(http, business, {
    query: EXPORT,
    variables: { input: { scope: 'selected', format: 'csv', productIds: [catalogOf(business).product.id] } },
    field: 'exportCatalogProducts',
  });
  const link = await ownerCall<{ importId: string; productId: string }>(http, business, {
    query: LINK,
    variables: { input: { url: LINK_FIXTURE_URL } },
    field: 'createCatalogLinkImport',
  });
  return { pack, spreadsheet, exportId: exported.exportId, link };
}

/** The rows of `business`. @throws Error when the controller has not run {@link seedCatalogImport} for it. */
export function catalogImportOf(business: BusinessWorld): CatalogImportWorld {
  const rows = CATALOG_IMPORT_WORLDS.get(business.label);
  if (rows === undefined) throw new Error(`no import rows for business ${business.label}: seedCatalogImport must run`);
  return rows;
}

/** Every value that identifies `rows` for the leak scanner: the job ids and the upload key. */
export const catalogImportFingerprints = (rows: CatalogImportWorld): string[] => [
  rows.spreadsheet.importId,
  rows.spreadsheet.uploadKey,
  rows.exportId,
  rows.link.importId,
];

const SNAPSHOT = `query ($pack: ID!, $importId: String!, $exportId: String!, $linkId: String!) {
  catalogPack(productId: $pack) { productId price weightGrams components { productId quantity } }
  catalogImport(id: $importId) { importId status rowCount summary { creates updates errors warnings } }
  catalogImportPreview(id: $importId) { totalItems items { rowNumber action productKey } }
  catalogExport(id: $exportId) { exportId status rowCount }
  catalogLinkImport(id: $linkId) { importId status productId }
}`;

/**
 * `business`'s pack and jobs as its owner reads them: no presigned link (each read signs a new one), and no pack status
 * (the recompute consumer may still be settling the seeded pack; its price and components are what a write would move).
 */
export async function importSnapshotOf(http: IsolationHttp, business: BusinessWorld): Promise<unknown> {
  const rows = catalogImportOf(business);
  const variables = {
    pack: rows.pack.productId,
    importId: rows.spreadsheet.importId,
    exportId: rows.exportId,
    linkId: rows.link.importId,
  };
  const exchange = await http.graphql(business.owner, SNAPSHOT, variables, ownChannel(business));
  return importSnapshotFrom(exchange, business.label);
}

/**
 * The data of a snapshot read, so a before/after comparison proves the rows unchanged: any GraphQL error throws (two
 * failed reads would compare equal), and so does a read with no pack or an import no longer `previewed`.
 * @throws Error naming business `label` when the read failed or is empty
 */
export function importSnapshotFrom(exchange: Exchange, label: string): Record<string, unknown> {
  const data = dataOf(exchange);
  const imported = data['catalogImport'] as { status?: string } | null | undefined;
  if (data['catalogPack'] == null || imported?.status !== 'previewed') {
    throw new Error(`import snapshot of business ${label} holds no pack or no previewed import`);
  }
  return data;
}

const EXPORT_LINK = 'query ($id: String!) { catalogExport(id: $id) { downloadUrl } }';

/**
 * The object key of `business`'s export file, read from a fresh download link of the e2e boot's memory storage.
 * @throws Error when the export has no file
 */
export async function exportKeyOf(http: IsolationHttp, business: BusinessWorld): Promise<string> {
  const exchange = await http.graphql(
    business.owner,
    EXPORT_LINK,
    { id: catalogImportOf(business).exportId },
    ownChannel(business),
  );
  const { downloadUrl } = fieldOf(exchange, 'catalogExport') as { downloadUrl: string | null };
  if (downloadUrl === null) throw new Error(`export of business ${business.label} has no file`);
  return keyOfMemoryLink(downloadUrl);
}
