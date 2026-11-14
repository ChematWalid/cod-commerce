/** The registry entries of the business's media library (Task 13). */
import { CATALOG_ERROR_CODES } from '@cod/shared';
import type { OperationEntry, RouteEntry } from './registry-calls';

const VIEW = 'catalog.products.view';
const EDIT = 'catalog.products.edit';
const about = { idField: 'mediaId', notFound: CATALOG_ERROR_CODES.MEDIA_NOT_FOUND } as const;

/** Every Admin API operation of the media library; the upload goes as a multipart request (`upload`). */
export const MEDIA_OPERATIONS: readonly OperationEntry[] = [
  {
    operation: 'catalogMedia',
    access: VIEW,
    foreign: 'own-only',
    byId: false,
    ...about,
    document: 'query { catalogMedia { totalItems items { id assetId } } }',
    variables: () => ({}),
  },
  {
    operation: 'uploadCatalogMedia',
    access: EDIT,
    foreign: 'own-only',
    byId: false,
    upload: true,
    ...about,
    document: 'mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id } }',
    variables: () => ({ file: null }),
  },
  {
    operation: 'deleteCatalogMedia',
    access: EDIT,
    foreign: 'not-found',
    byId: true,
    ...about,
    document: 'mutation ($id: String!) { deleteCatalogMedia(id: $id) }',
    variables: (ids) => ({ id: ids.mediaId }),
  },
];

/** Every REST route of the media library (the upload stays GraphQL, D2102). */
export const MEDIA_ROUTES: readonly RouteEntry[] = [
  { method: 'GET', route: '/catalog/media', access: VIEW, foreign: 'own-only', ...about, url: () => '/catalog/media' },
  {
    method: 'DELETE',
    route: '/catalog/media/:id',
    access: EDIT,
    foreign: 'not-found',
    ...about,
    url: (ids) => `/catalog/media/${ids.mediaId}`,
  },
];
