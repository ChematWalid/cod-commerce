import { CATALOG_ERROR_CODES } from '@cod/shared';
import { catalogOf } from '../catalog-world';
import type { MatrixRequest } from '../http';
import { type IsolationCase, ownerGraphql, ownerRest } from '../matrix';
import { CATALOG_SETTINGS } from '../seed-operations';
import { TEAM_WORLDS } from '../team-world';
import type { BusinessWorld } from '../world-types';

/**
 * The product cells of the P2 matrix (P2.S1) beyond the generated sweep: A's own lists, the slug check across
 * businesses (D2103), a create naming one of B's rows (D2134, D2114), variant patches naming B's rows (D2135), and
 * the default channel holding no business's catalog (D2133).
 */

const C = CATALOG_ERROR_CODES;
const PRODUCTS = 'query { catalogProducts { totalItems items { id title slug sku } } }';
const SLUG = 'query ($slug: String!) { catalogSlugAvailability(slug: $slug) { available slug } }';
const CREATE = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id title } }
}`;
const UPDATE = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id title } }
}`;
const STOCK_PRODUCTS = 'query { products(options: { take: 100 }) { totalItems items { id name slug } } }';
const STOCK_ASSETS = 'query { assets(options: { take: 100 }) { totalItems items { id source preview } } }';
/** What the slug check answers for a slug no product of the caller's store has. */
const AVAILABLE = '"available":true';

/** The member row of B's owner, an order manager of B only. @throws Error before `seedTeam`. */
function ownerMemberOf(business: BusinessWorld): string {
  const team = TEAM_WORLDS.get(business.label);
  if (team === undefined) throw new Error(`no Team rows for business ${business.label}`);
  return team.ownerMemberId;
}

/** A create on A's store naming one of B's rows; it must answer the row's not-found code and create nothing. */
function createNaming(
  id: string,
  row: string,
  input: (b: BusinessWorld) => Record<string, unknown>,
  code: string,
): IsolationCase {
  return {
    id: `catalog.createCatalogProduct.${id}`,
    entity: 'product',
    endpoint: 'createCatalogProduct',
    access: 'write',
    title: `A's owner creates a product naming B's ${row}: ${code}`,
    request: (a, b) =>
      ownerGraphql(a, CREATE, { input: { title: 'Synthetic product', status: 'active', price: 100, ...input(b) } }),
    expect: { kind: 'code', code },
    reverse: true,
  };
}

/** A variant patch of A's own product; it must answer `code` and leave the product as it was. */
function variantPatch(
  id: string,
  title: string,
  variant: (a: BusinessWorld, b: BusinessWorld) => Record<string, unknown>,
  code: string,
): IsolationCase {
  return {
    id: `catalog.updateCatalogProduct.${id}`,
    entity: 'product',
    endpoint: 'updateCatalogProduct',
    access: 'write',
    title: `A's owner patches a variant of A's product ${title}: ${code}`,
    request: (a, b) => ownerGraphql(a, UPDATE, { id: catalogOf(a).product.id, input: { variants: [variant(a, b)] } }),
    expect: { kind: 'code', code },
    reverse: true,
  };
}

/** The platform superadmin on the default channel: no business's product or image is there (D2133, D2113). */
function onDefaultChannel(id: string, endpoint: string, query: string): IsolationCase {
  return {
    id: `catalog.default-channel.${id}`,
    entity: id === 'products' ? 'product' : 'media',
    endpoint,
    access: 'list',
    title: `The superadmin lists stock ${id} on the default channel: none of B's catalog`,
    request: (_a, _b, world): MatrixRequest => ({
      method: 'POST',
      path: '/admin-api',
      caller: world.superadmin,
      body: { query },
    }),
    expect: { kind: 'own', mustInclude: () => [] },
    reverse: true,
  };
}

export const CATALOG_PRODUCT_CASES: readonly IsolationCase[] = [
  {
    id: 'catalog.catalogProducts.list',
    entity: 'product',
    endpoint: 'catalogProducts',
    access: 'list',
    title: "A's owner lists A's products: A's own only",
    request: (a) => ownerGraphql(a, PRODUCTS),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).product.title, catalogOf(a).product.sku] },
    reverse: true,
  },
  {
    id: 'catalog.get-/catalog/products.list',
    entity: 'product',
    endpoint: 'GET /catalog/products',
    access: 'list',
    title: "A's owner lists A's products over REST: A's own only",
    request: (a) => ownerRest(a, 'GET', '/catalog/products'),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).product.title] },
    reverse: true,
  },
  {
    id: 'catalog.catalogSlugAvailability.foreign-slug',
    entity: 'product',
    endpoint: 'catalogSlugAvailability',
    access: 'read by id',
    title: "A's owner checks B's product slug on A's store: available (slugs are per store)",
    request: (a, b) => ownerGraphql(a, SLUG, { slug: catalogOf(b).product.slug }),
    expect: { kind: 'own', mustInclude: () => [AVAILABLE] },
    reverse: true,
  },
  {
    id: 'catalog.get-/catalog/products/slug-availability.foreign-slug',
    entity: 'product',
    endpoint: 'GET /catalog/products/slug-availability',
    access: 'read by id',
    title: "A's owner checks B's product slug over REST: available",
    request: (a, b) =>
      ownerRest(a, 'GET', `/catalog/products/slug-availability?slug=${encodeURIComponent(catalogOf(b).product.slug)}`),
    expect: { kind: 'own', mustInclude: () => [AVAILABLE] },
    reverse: true,
  },
  {
    id: 'catalog.catalogSlugAvailability.own-slug',
    entity: 'product',
    endpoint: 'catalogSlugAvailability',
    access: 'list',
    title: "A's owner checks A's own product slug: taken (positive control)",
    request: (a) => ownerGraphql(a, SLUG, { slug: catalogOf(a).product.slug }),
    expect: { kind: 'own', mustInclude: (a) => ['"available":false', catalogOf(a).product.slug] },
  },
  createNaming('foreign-brand', 'brand', (b) => ({ brandId: catalogOf(b).brand.id }), C.BRAND_NOT_FOUND),
  createNaming('foreign-tag', 'tag', (b) => ({ tagIds: [catalogOf(b).tag.id] }), C.TAG_NOT_FOUND),
  createNaming(
    'foreign-highlight',
    'highlight',
    (b) => ({ highlightIds: [catalogOf(b).highlight.id] }),
    C.HIGHLIGHT_NOT_FOUND,
  ),
  createNaming('foreign-image', 'image', (b) => ({ featuredAssetId: catalogOf(b).media.assetId }), C.MEDIA_NOT_FOUND),
  createNaming(
    'foreign-gallery-image',
    'gallery image',
    (b) => ({ assetIds: [catalogOf(b).media.assetId] }),
    C.MEDIA_NOT_FOUND,
  ),
  createNaming(
    'foreign-collection',
    'collection',
    (b) => ({ collectionIds: [catalogOf(b).collection.id] }),
    C.COLLECTION_NOT_FOUND,
  ),
  createNaming(
    'foreign-order-manager',
    'member as order manager',
    (b) => ({ settings: { ...CATALOG_SETTINGS, orderManagerIds: [ownerMemberOf(b)] } }),
    C.ORDER_MANAGER_UNKNOWN,
  ),
  variantPatch(
    'foreign-variant',
    "naming B's variant id",
    (_a, b) => ({ id: catalogOf(b).product.variantIds[0], price: 1 }),
    C.PRODUCT_NOT_FOUND,
  ),
  variantPatch(
    'foreign-variant-image',
    "with B's image as the variant image",
    (a, b) => ({ id: catalogOf(a).product.variantIds[0], featuredAssetId: catalogOf(b).media.assetId }),
    C.MEDIA_NOT_FOUND,
  ),
  onDefaultChannel('products', 'products', STOCK_PRODUCTS),
  onDefaultChannel('assets', 'assets', STOCK_ASSETS),
];
