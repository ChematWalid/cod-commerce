import type { RouteEntry } from './registry-calls';
import { TAXONOMY_ROUTES } from './taxonomy-registry';

const productUrl =
  (suffix = '') =>
  (ids: { readonly productId: string }): string =>
    `/catalog/products/${ids.productId}${suffix}`;

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  {
    method: 'GET',
    route: '/catalog/products',
    access: 'catalog.products.view',
    foreign: 'own-only',
    url: (ids) => `/catalog/products?collectionId=${ids.collectionId}`,
  },
  {
    method: 'GET',
    route: '/catalog/products/slug-availability',
    access: 'catalog.products.view',
    foreign: 'own-only',
    url: () => '/catalog/products/slug-availability?slug=synthetic-target-slug',
  },
  {
    method: 'GET',
    route: '/catalog/products/:id',
    access: 'catalog.products.view',
    foreign: 'not-found',
    url: productUrl(),
  },
  {
    method: 'POST',
    route: '/catalog/products',
    access: 'catalog.products.create',
    foreign: 'not-found',
    url: () => '/catalog/products',
    body: (ids) => ({ title: 'Synthetic product', status: 'active', price: 100, collectionIds: [ids.collectionId] }),
  },
  {
    method: 'PATCH',
    route: '/catalog/products/:id',
    access: 'catalog.products.edit',
    foreign: 'not-found',
    url: productUrl(),
    body: () => ({ label: 'Synthetic' }),
  },
  {
    method: 'POST',
    route: '/catalog/products/:id/status',
    access: 'catalog.products.edit',
    foreign: 'not-found',
    url: productUrl('/status'),
    body: () => ({ status: 'draft' }),
  },
  {
    method: 'DELETE',
    route: '/catalog/products/:id',
    access: 'catalog.products.delete',
    foreign: 'not-found',
    url: productUrl(),
  },
  ...TAXONOMY_ROUTES,
];
