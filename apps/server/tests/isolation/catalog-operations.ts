import { CATALOG_ERROR_CODES } from '@cod/shared';
import { catalogOf } from './catalog-world';
import type { IsolationEntity } from './matrix';
import type { BusinessWorld } from './world-types';

/**
 * Every catalog endpoint (P2.S1) as the P2 matrix calls it: each Admin API operation and each REST route, the matrix
 * row it belongs to, and, for a by-id one, which row it names and what "no such row" answers. The catalog cases build
 * their cells from these lists, so a new endpoint is one entry here.
 */

/** The rows of a business a call may name; for REST the product id is the REST form (`restIdOf`). */
export interface CatalogTarget {
  readonly productId: string;
  readonly variantId: string;
  readonly brandId: string;
  readonly tagId: string;
  readonly highlightId: string;
  readonly mediaId: string;
  readonly assetId: string;
  readonly collectionId: string;
  readonly slug: string;
}

/** The field of {@link CatalogTarget} a by-id endpoint names. */
export type TargetField = 'productId' | 'brandId' | 'tagId' | 'highlightId' | 'mediaId';

/** The rows of `business` as GraphQL names them. */
export function targetOf(business: BusinessWorld): CatalogTarget {
  const catalog = catalogOf(business);
  return {
    productId: catalog.product.id,
    variantId: catalog.product.variantIds[0] ?? '',
    brandId: catalog.brand.id,
    tagId: catalog.tag.id,
    highlightId: catalog.highlight.id,
    mediaId: catalog.media.id,
    assetId: catalog.media.assetId,
    collectionId: catalog.collection.id,
    slug: catalog.product.slug,
  };
}

/** The rows of `business` as the REST routes name them. */
export const restTargetOf = (business: BusinessWorld): CatalogTarget => ({
  ...targetOf(business),
  productId: catalogOf(business).product.restId,
});

/** What a by-id endpoint answers for an id that is not a row of the caller's store. */
export interface ById {
  readonly field: TargetField;
  /** The error code; `null` for a read whose answer is a null field instead. */
  readonly notFound: string | null;
}

/** One Admin API operation. */
export interface CatalogOperation {
  readonly name: string;
  readonly entity: IsolationEntity;
  readonly document: string;
  readonly variables: (target: CatalogTarget) => Record<string, unknown>;
  readonly byId?: ById;
  /** Sent as a multipart upload of a one-pixel PNG at `$file`. */
  readonly upload?: true;
}

/** One REST route. */
export interface CatalogRoute {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The route as the controller declares it, e.g. `/catalog/products/:id`. */
  readonly route: string;
  readonly entity: IsolationEntity;
  readonly path: (target: CatalogTarget) => string;
  readonly body?: () => Record<string, unknown>;
  readonly byId?: ById & { readonly notFound: string };
}

const C = CATALOG_ERROR_CODES;
const SYNTHETIC_PRODUCT = { title: 'Synthetic product', status: 'active', price: 100 };

const PRODUCT_OPERATIONS: readonly CatalogOperation[] = [
  {
    name: 'catalogProducts',
    entity: 'product',
    document: 'query { catalogProducts { totalItems items { id title slug sku } } }',
    variables: () => ({}),
  },
  {
    name: 'catalogProduct',
    entity: 'product',
    document: 'query ($id: ID!) { catalogProduct(id: $id) { id title slug sku } }',
    variables: (t) => ({ id: t.productId }),
    byId: { field: 'productId', notFound: null },
  },
  {
    name: 'catalogSlugAvailability',
    entity: 'product',
    document: 'query ($slug: String!) { catalogSlugAvailability(slug: $slug) { available slug } }',
    variables: (t) => ({ slug: t.slug }),
  },
  {
    name: 'createCatalogProduct',
    entity: 'product',
    document:
      'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    variables: () => ({ input: SYNTHETIC_PRODUCT }),
  },
  {
    name: 'updateCatalogProduct',
    entity: 'product',
    document: `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id title } }
}`,
    variables: (t) => ({ id: t.productId, input: { label: 'Synthetic' } }),
    byId: { field: 'productId', notFound: C.PRODUCT_NOT_FOUND },
  },
  {
    name: 'setCatalogProductStatus',
    entity: 'product',
    document: 'mutation ($id: ID!) { setCatalogProductStatus(id: $id, status: draft) { id title } }',
    variables: (t) => ({ id: t.productId }),
    byId: { field: 'productId', notFound: C.PRODUCT_NOT_FOUND },
  },
  {
    name: 'deleteCatalogProduct',
    entity: 'product',
    document: 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }',
    variables: (t) => ({ id: t.productId }),
    byId: { field: 'productId', notFound: C.PRODUCT_NOT_FOUND },
  },
];

/** A brand, a tag or a highlight as the API names it. */
interface TaxonomyKind {
  readonly name: 'Brand' | 'Tag' | 'Highlight';
  readonly path: string;
  readonly entity: IsolationEntity;
  readonly field: TargetField;
  readonly notFound: string;
  /** The field of its input and answer. */
  readonly text: 'name' | 'text';
}

export const TAXONOMY_KINDS: readonly TaxonomyKind[] = [
  { name: 'Brand', path: 'brands', entity: 'brand', field: 'brandId', notFound: C.BRAND_NOT_FOUND, text: 'name' },
  { name: 'Tag', path: 'tags', entity: 'product tag', field: 'tagId', notFound: C.TAG_NOT_FOUND, text: 'name' },
  {
    name: 'Highlight',
    path: 'highlights',
    entity: 'highlight',
    field: 'highlightId',
    notFound: C.HIGHLIGHT_NOT_FOUND,
    text: 'text',
  },
];

function taxonomyOperations({ name, entity, field, notFound, text }: TaxonomyKind): CatalogOperation[] {
  const input = { [text]: `Synthetic ${name}` };
  const byId: ById = { field, notFound };
  return [
    { name: `catalog${name}s`, entity, document: `query { catalog${name}s { id ${text} } }`, variables: () => ({}) },
    {
      name: `createCatalog${name}`,
      entity,
      document: `mutation ($input: Catalog${name}Input!) { createCatalog${name}(input: $input) { id } }`,
      variables: () => ({ input }),
    },
    {
      name: `updateCatalog${name}`,
      entity,
      document: `mutation ($id: String!, $input: Catalog${name}Input!) { updateCatalog${name}(id: $id, input: $input) { id ${text} } }`,
      variables: (t) => ({ id: t[field], input }),
      byId,
    },
    {
      name: `deleteCatalog${name}`,
      entity,
      document: `mutation ($id: String!) { deleteCatalog${name}(id: $id) }`,
      variables: (t) => ({ id: t[field] }),
      byId,
    },
  ];
}

const MEDIA_OPERATIONS: readonly CatalogOperation[] = [
  {
    name: 'catalogMedia',
    entity: 'media',
    document: 'query { catalogMedia { totalItems items { id assetId } } }',
    variables: () => ({}),
  },
  {
    name: 'uploadCatalogMedia',
    entity: 'media',
    document: 'mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId } }',
    variables: () => ({ file: null }),
    upload: true,
  },
  {
    name: 'deleteCatalogMedia',
    entity: 'media',
    document: 'mutation ($id: String!) { deleteCatalogMedia(id: $id) }',
    variables: (t) => ({ id: t.mediaId }),
    byId: { field: 'mediaId', notFound: C.MEDIA_NOT_FOUND },
  },
];

/** Every Admin API operation of the catalog plugin. */
export const CATALOG_OPERATIONS: readonly CatalogOperation[] = [
  ...PRODUCT_OPERATIONS,
  ...TAXONOMY_KINDS.flatMap(taxonomyOperations),
  ...MEDIA_OPERATIONS,
];

const PRODUCT_BY_ID = { field: 'productId', notFound: C.PRODUCT_NOT_FOUND } as const;
const productPath =
  (suffix = '') =>
  (t: CatalogTarget): string =>
    `/catalog/products/${t.productId}${suffix}`;

const PRODUCT_ROUTES: readonly CatalogRoute[] = [
  { method: 'GET', route: '/catalog/products', entity: 'product', path: () => '/catalog/products' },
  {
    method: 'GET',
    route: '/catalog/products/slug-availability',
    entity: 'product',
    path: (t) => `/catalog/products/slug-availability?slug=${encodeURIComponent(t.slug)}`,
  },
  { method: 'GET', route: '/catalog/products/:id', entity: 'product', path: productPath(), byId: PRODUCT_BY_ID },
  {
    method: 'POST',
    route: '/catalog/products',
    entity: 'product',
    path: () => '/catalog/products',
    body: () => SYNTHETIC_PRODUCT,
  },
  {
    method: 'PATCH',
    route: '/catalog/products/:id',
    entity: 'product',
    path: productPath(),
    body: () => ({ label: 'Synthetic' }),
    byId: PRODUCT_BY_ID,
  },
  {
    method: 'POST',
    route: '/catalog/products/:id/status',
    entity: 'product',
    path: productPath('/status'),
    body: () => ({ status: 'draft' }),
    byId: PRODUCT_BY_ID,
  },
  { method: 'DELETE', route: '/catalog/products/:id', entity: 'product', path: productPath(), byId: PRODUCT_BY_ID },
];

function taxonomyRoutes({ name, path, entity, field, notFound, text }: TaxonomyKind): CatalogRoute[] {
  const base = `/catalog/${path}`;
  const body = () => ({ [text]: `Synthetic ${name}` });
  const byId = { field, notFound };
  const one = (t: CatalogTarget): string => `${base}/${t[field]}`;
  return [
    { method: 'GET', route: base, entity, path: () => base },
    { method: 'POST', route: base, entity, path: () => base, body },
    { method: 'PATCH', route: `${base}/:id`, entity, path: one, body, byId },
    { method: 'DELETE', route: `${base}/:id`, entity, path: one, byId },
  ];
}

const MEDIA_ROUTES: readonly CatalogRoute[] = [
  { method: 'GET', route: '/catalog/media', entity: 'media', path: () => '/catalog/media' },
  {
    method: 'DELETE',
    route: '/catalog/media/:id',
    entity: 'media',
    path: (t) => `/catalog/media/${t.mediaId}`,
    byId: { field: 'mediaId', notFound: C.MEDIA_NOT_FOUND },
  },
];

/** Every REST route of the catalog plugin (the upload stays GraphQL, D2102). */
export const CATALOG_ROUTES: readonly CatalogRoute[] = [
  ...PRODUCT_ROUTES,
  ...TAXONOMY_KINDS.flatMap(taxonomyRoutes),
  ...MEDIA_ROUTES,
];
