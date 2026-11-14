import { CATALOG_ERROR_CODES } from '@cod/shared';
import { catalogOf } from '../catalog-world';
import type { MatrixRequest } from '../http';
import { type IsolationCase, ownChannel, ownerGraphql, ownerRest } from '../matrix';
import type { BusinessWorld } from '../world-types';

/**
 * The media library cells (P2.S1, D2113, D2132): the library is the business's, so A's owner sees the images of both
 * of A's stores and none of B's; A's member, limited to A's first store, sees, deletes and attaches only that store's
 * images. By-id calls, B's token and malformed ids come from the sweep.
 */

const C = CATALOG_ERROR_CODES;
const MEDIA = 'query { catalogMedia { totalItems items { id assetId } } }';
const DELETE = 'mutation ($id: String!) { deleteCatalogMedia(id: $id) }';
const CREATE = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id title } }
}`;

/** A GraphQL call of A's member on A's first store. */
const memberGraphql = (a: BusinessWorld, query: string, variables: Record<string, unknown> = {}): MatrixRequest => ({
  method: 'POST',
  path: '/admin-api',
  caller: a.member,
  channel: ownChannel(a),
  body: { query, variables },
});

/** A REST call of A's member on A's first store. */
const memberRest = (a: BusinessWorld, method: MatrixRequest['method'], path: string): MatrixRequest => ({
  method,
  path,
  caller: a.member,
  channel: ownChannel(a),
});

const firstStoreOnly = {
  kind: 'own',
  mustInclude: (a: BusinessWorld) => [catalogOf(a).media.id],
  mustExclude: (a: BusinessWorld) => [catalogOf(a).otherStoreMedia.id],
} as const;

export const CATALOG_MEDIA_CASES: readonly IsolationCase[] = [
  {
    id: 'catalog.catalogMedia.list',
    entity: 'media',
    endpoint: 'catalogMedia',
    access: 'list',
    title: "A's owner lists A's media library: the images of both of A's stores, none of B's",
    request: (a) => ownerGraphql(a, MEDIA),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).media.id, catalogOf(a).otherStoreMedia.id] },
    reverse: true,
  },
  {
    id: 'catalog.get-/catalog/media.list',
    entity: 'media',
    endpoint: 'GET /catalog/media',
    access: 'list',
    title: "A's owner lists A's media library over REST: both of A's stores, none of B's",
    request: (a) => ownerRest(a, 'GET', '/catalog/media'),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).media.id, catalogOf(a).otherStoreMedia.id] },
    reverse: true,
  },
  {
    id: 'catalog.catalogMedia.member-list',
    entity: 'media',
    endpoint: 'catalogMedia',
    access: 'list',
    title: "A's member (first store only) lists the library: the first store's images only",
    request: (a) => memberGraphql(a, MEDIA),
    expect: firstStoreOnly,
    reverse: true,
  },
  {
    id: 'catalog.get-/catalog/media.member-list',
    entity: 'media',
    endpoint: 'GET /catalog/media',
    access: 'list',
    title: "A's member (first store only) lists the library over REST: the first store's images only",
    request: (a) => memberRest(a, 'GET', '/catalog/media'),
    expect: firstStoreOnly,
    reverse: true,
  },
  {
    id: 'catalog.deleteCatalogMedia.member-other-store-image',
    entity: 'media',
    endpoint: 'deleteCatalogMedia',
    access: 'write',
    title: `A's member (first store only) deletes an image of A's second store: ${C.MEDIA_NOT_FOUND}`,
    request: (a) => memberGraphql(a, DELETE, { id: catalogOf(a).otherStoreMedia.id }),
    expect: { kind: 'code', code: C.MEDIA_NOT_FOUND },
    reverse: true,
  },
  {
    id: 'catalog.delete-/catalog/media/:id.member-other-store-image',
    entity: 'media',
    endpoint: 'DELETE /catalog/media/:id',
    access: 'write',
    title: `A's member (first store only) deletes an image of A's second store over REST: 404 ${C.MEDIA_NOT_FOUND}`,
    request: (a) => memberRest(a, 'DELETE', `/catalog/media/${catalogOf(a).otherStoreMedia.id}`),
    expect: { kind: 'status', status: 404, code: C.MEDIA_NOT_FOUND },
    reverse: true,
  },
  {
    id: 'catalog.createCatalogProduct.member-other-store-image',
    entity: 'media',
    endpoint: 'createCatalogProduct',
    access: 'write',
    title: `A's member (first store only) creates a product showing an image of A's second store: ${C.MEDIA_NOT_FOUND}`,
    request: (a) =>
      memberGraphql(a, CREATE, {
        input: {
          title: 'Synthetic product',
          status: 'active',
          price: 100,
          featuredAssetId: catalogOf(a).otherStoreMedia.assetId,
        },
      }),
    expect: { kind: 'code', code: C.MEDIA_NOT_FOUND },
    reverse: true,
  },
];
