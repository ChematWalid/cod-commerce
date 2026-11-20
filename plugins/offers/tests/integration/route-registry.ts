import { OFFER_PERMISSIONS } from '../../api/permissions';
import { offerNaming, type RouteEntry, type TargetIds } from './registry-calls';

const { view, create, edit, delete: remove } = OFFER_PERMISSIONS;

const offerUrl =
  (suffix = '') =>
  (ids: TargetIds): string =>
    `/offers/${ids.offerId}${suffix}`;

/** A lifecycle route of one offer id. */
const moveRoute = (move: string, access: RouteEntry['access']): RouteEntry => ({
  method: 'POST',
  route: `/offers/:id/${move}`,
  access,
  foreign: 'not-found',
  url: offerUrl(`/${move}`),
});

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  {
    method: 'GET',
    route: '/offers',
    access: view,
    foreign: 'own-only',
    url: (ids) => `/offers?productId=${ids.productId}`,
  },
  { method: 'GET', route: '/offers/app-types', access: view, foreign: 'no-read', url: () => '/offers/app-types' },
  {
    method: 'POST',
    route: '/offers/preview',
    access: view,
    foreign: 'no-read',
    idField: 'variantId',
    url: () => '/offers/preview',
    body: (ids) => ({ offer: offerNaming(ids) }),
  },
  { method: 'GET', route: '/offers/:id', access: view, foreign: 'not-found', url: offerUrl() },
  { method: 'GET', route: '/offers/:id/stats', access: view, foreign: 'not-found', url: offerUrl('/stats') },
  { method: 'GET', route: '/offers/:id/codes', access: view, foreign: 'not-found', url: offerUrl('/codes') },
  {
    method: 'POST',
    route: '/offers',
    access: create,
    foreign: 'dangling',
    idField: 'variantId',
    url: () => '/offers',
    body: offerNaming,
  },
  {
    method: 'PATCH',
    route: '/offers/:id',
    access: edit,
    foreign: 'not-found',
    url: offerUrl(),
    body: () => ({ title: 'Synthetic' }),
  },
  moveRoute('publish', edit),
  moveRoute('pause', edit),
  moveRoute('resume', edit),
  moveRoute('archive', edit),
  moveRoute('duplicate', create),
  { method: 'DELETE', route: '/offers/:id', access: remove, foreign: 'not-found', url: offerUrl() },
  {
    method: 'POST',
    route: '/offers/:id/codes',
    access: edit,
    foreign: 'not-found',
    url: offerUrl('/codes'),
    body: () => ({ codes: [{ code: 'SYNTHETIC1' }] }),
  },
  {
    method: 'POST',
    route: '/offers/:id/codes/generate',
    access: edit,
    foreign: 'not-found',
    url: offerUrl('/codes/generate'),
    body: () => ({ count: 2 }),
  },
  {
    method: 'DELETE',
    route: '/offers/:id/codes/:code',
    access: edit,
    foreign: 'not-found',
    url: (ids) => `/offers/${ids.offerId}/codes/${encodeURIComponent(ids.code)}`,
  },
];
