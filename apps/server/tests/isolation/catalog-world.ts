import { type Caller, fieldOf, type IsolationHttp, type MatrixRequest } from './http';
import { ownChannel } from './matrix';
import {
  CATALOG_AREA_LEVELS,
  CATALOG_SETTINGS,
  CREATE_CATALOG_BRAND,
  CREATE_CATALOG_HIGHLIGHT,
  CREATE_CATALOG_PRODUCT,
  CREATE_CATALOG_TAG,
  CREATE_ROLE,
  ONE_PIXEL_PNG,
  SET_MEMBER_ACCESS,
  STOCK_CREATE_COLLECTION,
  UPLOAD_CATALOG_MEDIA,
} from './seed-operations';
import { TEAM_WORLDS } from './team-world';
import type { BusinessWorld, WorldStore } from './world-types';

/** A media item of the library: our snowflake and the Vendure asset behind it. */
export interface WorldMedia {
  readonly id: string;
  readonly assetId: string;
}

/**
 * The catalog rows (plugins/catalog, P2.S1) of one business, seeded through the catalog Admin API as its owner on its
 * first store, except the collection (stock API, as the superadmin: no merchant creates one before P2.S3) and the
 * media item of the second store. Names carry the business id, so they are unique to the run like the rest of the world.
 */
export interface CatalogWorld {
  readonly brand: { readonly id: string; readonly name: string };
  readonly tag: { readonly id: string; readonly name: string };
  readonly highlight: { readonly id: string; readonly text: string };
  readonly collection: { readonly id: string; readonly name: string };
  /** Uploaded on the first store and shown by the product. */
  readonly media: WorldMedia;
  /** Uploaded on the second store: the member, who reaches the first store only, may not see it (D2132). */
  readonly otherStoreMedia: WorldMedia;
  /** A product of the first store with a Size option (two variants), naming every row above and the owner's member. */
  readonly product: {
    readonly id: string;
    /** The id as the REST routes take it: the e2e boot's GraphQL ids carry a `T_` prefix, REST ids do not. */
    readonly restId: string;
    readonly title: string;
    readonly slug: string;
    readonly sku: string;
    readonly variantIds: readonly string[];
  };
  /** A business role with the whole catalog area, given to the world's member on the first store only. */
  readonly catalogRole: { readonly id: string; readonly name: string };
}

/**
 * The catalog rows of businesses A and B, filled by the controller with {@link seedCatalog}, like `TEAM_WORLDS`. The
 * catalog cases read the victim's (and the attacker's) rows from here.
 */
export const CATALOG_WORLDS = new Map<'A' | 'B', CatalogWorld>();

/** An engine id as the REST routes take it (see `world.ts`). */
export const restIdOf = (id: string): string => id.replace(/^T_/, '');

const channelOf = (store: WorldStore): NonNullable<MatrixRequest['channel']> => ({
  label: store.label,
  token: store.channelToken,
});

const PRODUCT_PRICE = 1500;
const SIZE_VALUES = ['S', 'M'];

/** Creates a collection of the store's channel through the stock API, as the platform superadmin. */
async function createCollection(http: IsolationHttp, superadmin: Caller, store: WorldStore, name: string) {
  const translation = { languageCode: 'ar', name, slug: `collection-${store.id}`, description: '' };
  const input = { translations: [translation], filters: [] };
  const created = fieldOf(
    await http.graphql(superadmin, STOCK_CREATE_COLLECTION, { input }, channelOf(store)),
    'createCollection',
  ) as { id: string };
  return { id: created.id, name };
}

/** Uploads the one-pixel PNG to the library of `store`, as `caller`. */
async function uploadMedia(http: IsolationHttp, caller: Caller, store: WorldStore): Promise<WorldMedia> {
  const exchange = await http.upload(
    caller,
    UPLOAD_CATALOG_MEDIA,
    { bytes: ONE_PIXEL_PNG, name: 'photo.png' },
    channelOf(store),
  );
  return fieldOf(exchange, 'uploadCatalogMedia') as WorldMedia;
}

/** Gives the world's member a catalog role beside its own, still on the first store only (D2132). */
async function grantCatalogToMember(http: IsolationHttp, business: BusinessWorld) {
  const as = async <T>(query: string, variables: Record<string, unknown>, field: string): Promise<T> =>
    fieldOf(await http.graphql(business.owner, query, variables, ownChannel(business)), field) as T;
  const roleInput = { name: `Catalog role ${business.label} ${business.businessId}`, areaLevels: CATALOG_AREA_LEVELS };
  const role = await as<{ id: string; name: string }>(CREATE_ROLE, { input: roleInput }, 'createBusinessRole');
  const access = {
    administratorId: business.member.administratorId,
    roleIds: [business.role.id, role.id],
    storeAccess: 'selected',
    storeIds: [business.stores[0].id],
  };
  await as(SET_MEMBER_ACCESS, { input: access }, 'setMemberAccess');
  return role;
}

/**
 * Seeds `business`'s catalog rows: a collection, a brand, a tag, a highlight, a media item on each store, a product
 * naming them all, and the member's catalog role. Runs after {@link TEAM_WORLDS} is filled (the product names the
 * owner's member row as its order manager).
 *
 * @throws Error when a call fails or the business has no Team rows.
 */
export async function seedCatalog(http: IsolationHttp, superadmin: Caller, business: BusinessWorld) {
  const team = TEAM_WORLDS.get(business.label);
  if (team === undefined) throw new Error(`business ${business.label}: seedTeam must run before seedCatalog`);
  const [first, second] = business.stores;
  const as = async <T>(query: string, variables: Record<string, unknown>, field: string): Promise<T> =>
    fieldOf(await http.graphql(business.owner, query, variables, channelOf(first)), field) as T;
  const tag = `${business.label} ${business.businessId}`;
  const collection = await createCollection(http, superadmin, first, `Collection ${tag}`);
  const brand = await as<CatalogWorld['brand']>(
    CREATE_CATALOG_BRAND,
    { input: { name: `Brand ${tag}` } },
    'createCatalogBrand',
  );
  const productTag = await as<CatalogWorld['tag']>(
    CREATE_CATALOG_TAG,
    { input: { name: `Tag ${tag}` } },
    'createCatalogTag',
  );
  const highlight = await as<CatalogWorld['highlight']>(
    CREATE_CATALOG_HIGHLIGHT,
    { input: { text: `Highlight ${tag}` } },
    'createCatalogHighlight',
  );
  const media = await uploadMedia(http, business.owner, first);
  const otherStoreMedia = await uploadMedia(http, business.owner, second);
  const code = `iso-${business.label.toLowerCase()}-${business.businessId}`;
  const productInput = {
    title: `Product ${tag}`,
    slug: code,
    sku: code.toUpperCase(),
    status: 'active',
    price: PRODUCT_PRICE,
    brandId: brand.id,
    tagIds: [productTag.id],
    highlightIds: [highlight.id],
    collectionIds: [collection.id],
    featuredAssetId: media.assetId,
    assetIds: [media.assetId],
    optionGroups: [{ name: 'Size', values: SIZE_VALUES }],
    settings: { ...CATALOG_SETTINGS, orderManagerIds: [team.ownerMemberId] },
  };
  const saved = await as<{ product: { id: string; variants: readonly { id: string }[] } }>(
    CREATE_CATALOG_PRODUCT,
    { input: productInput },
    'createCatalogProduct',
  );
  const catalogRole = await grantCatalogToMember(http, business);
  return {
    brand,
    tag: productTag,
    highlight,
    collection,
    media,
    otherStoreMedia,
    product: {
      id: saved.product.id,
      restId: restIdOf(saved.product.id),
      title: productInput.title,
      slug: productInput.slug,
      sku: productInput.sku,
      variantIds: saved.product.variants.map((variant) => variant.id),
    },
    catalogRole,
  } satisfies CatalogWorld;
}

/** The catalog rows of `business`. @throws Error when the controller has not run {@link seedCatalog} for it. */
export function catalogOf(business: BusinessWorld): CatalogWorld {
  const catalog = CATALOG_WORLDS.get(business.label);
  if (catalog === undefined) throw new Error(`no catalog rows for business ${business.label}: seedCatalog must run`);
  return catalog;
}

/** Every value that identifies `catalog`'s rows, for the leak scanner (with `fingerprintsOf` of its business). */
export function catalogFingerprints(catalog: CatalogWorld): string[] {
  return [
    catalog.brand.id,
    catalog.brand.name,
    catalog.tag.id,
    catalog.tag.name,
    catalog.highlight.id,
    catalog.highlight.text,
    catalog.collection.name,
    catalog.media.id,
    catalog.otherStoreMedia.id,
    catalog.product.title,
    catalog.product.slug,
    catalog.product.sku,
    catalog.catalogRole.id,
    catalog.catalogRole.name,
  ];
}

/** What the owner's snapshot reads of the catalog of its first store (with `snapshotOf`'s fields). */
export const CATALOG_SNAPSHOT_FIELDS = `
  catalogProducts {
    totalItems
    items {
      id title slug status price sku label brandId tagIds highlightIds collectionIds updatedAt
      featuredAsset { id } assets { id }
      variants { id sku price isHidden featuredAsset { id } }
      settings { orderManagerIds soldOut allowOutOfStockOrders }
    }
  }
  catalogBrands { id name updatedAt }
  catalogTags { id name updatedAt }
  catalogHighlights { id text updatedAt }
  catalogMedia { totalItems items { id assetId } }
`;
