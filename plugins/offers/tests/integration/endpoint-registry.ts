/**
 * The registry of every offers handler: its operation or route, permission, a call aimed at a target's ids, and what
 * another business gets back. The coverage test, the isolation sweep and the permission suite all read it.
 */
import { OFFER_PERMISSIONS } from '../../api/permissions';
import { offerNaming, type OperationEntry } from './registry-calls';

export { ROUTE_REGISTRY } from './route-registry';
export {
  type ForeignOutcome,
  idFieldOf,
  offerNaming,
  type OperationEntry,
  operationKey,
  type RouteEntry,
  routeKey,
  type TargetIdField,
  type TargetIds,
} from './registry-calls';

const { view, create, edit, delete: remove } = OFFER_PERMISSIONS;

/** A lifecycle mutation of one offer id, answering its view. */
const moveEntry = (operation: string, access: OperationEntry['access']): OperationEntry => ({
  operation,
  access,
  foreign: 'not-found',
  byId: true,
  document: `mutation ($id: String!) { ${operation}(id: $id) { id } }`,
  variables: (ids) => ({ id: ids.offerId }),
});

/** Every Admin API operation the plugin's resolver declares. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'offers',
    access: view,
    foreign: 'own-only',
    byId: false,
    document: 'query ($options: OfferListInput) { offers(options: $options) { totalItems items { id } } }',
    variables: (ids) => ({ options: { productId: ids.productId } }),
  },
  {
    operation: 'offer',
    access: view,
    foreign: 'null',
    byId: true,
    document: 'query ($id: String!) { offer(id: $id) { id } }',
    variables: (ids) => ({ id: ids.offerId }),
  },
  {
    operation: 'offerCodes',
    access: view,
    foreign: 'not-found',
    byId: true,
    document: 'query ($offerId: String!) { offerCodes(offerId: $offerId) { id code } }',
    variables: (ids) => ({ offerId: ids.offerId }),
  },
  {
    operation: 'offerStats',
    access: view,
    foreign: 'not-found',
    byId: true,
    document: 'query ($id: String!) { offerStats(id: $id) { orders } }',
    variables: (ids) => ({ id: ids.offerId }),
  },
  {
    operation: 'offerAppTypes',
    access: view,
    foreign: 'no-read',
    byId: false,
    document: 'query { offerAppTypes { id } }',
    variables: () => ({}),
  },
  {
    operation: 'previewOffer',
    access: view,
    foreign: 'no-read',
    byId: false,
    idField: 'variantId',
    document: 'query ($input: OfferPreviewInput!) { previewOffer(input: $input) { warnings } }',
    variables: (ids) => ({ input: { offer: offerNaming(ids) } }),
  },
  {
    operation: 'createOffer',
    access: create,
    foreign: 'unknown-target',
    byId: false,
    idField: 'variantId',
    document: 'mutation ($input: CreateOfferInput!) { createOffer(input: $input) { id targets { refId } } }',
    variables: (ids) => ({ input: offerNaming(ids) }),
  },
  {
    operation: 'updateOffer',
    access: edit,
    foreign: 'not-found',
    byId: true,
    document: 'mutation ($id: String!, $input: UpdateOfferInput!) { updateOffer(id: $id, input: $input) { id } }',
    variables: (ids) => ({ id: ids.offerId, input: { title: 'Synthetic' } }),
  },
  moveEntry('publishOffer', edit),
  moveEntry('pauseOffer', edit),
  moveEntry('resumeOffer', edit),
  moveEntry('archiveOffer', edit),
  moveEntry('duplicateOffer', create),
  {
    operation: 'deleteOffer',
    access: remove,
    foreign: 'not-found',
    byId: true,
    document: 'mutation ($id: String!) { deleteOffer(id: $id) }',
    variables: (ids) => ({ id: ids.offerId }),
  },
  {
    operation: 'addOfferCodes',
    access: edit,
    foreign: 'not-found',
    byId: true,
    document:
      'mutation ($offerId: String!, $codes: [OfferCodeInput!]!) { addOfferCodes(offerId: $offerId, codes: $codes) { id } }',
    variables: (ids) => ({ offerId: ids.offerId, codes: [{ code: 'SYNTHETIC1' }] }),
  },
  {
    operation: 'generateOfferCodes',
    access: edit,
    foreign: 'not-found',
    byId: true,
    document:
      'mutation ($offerId: String!, $input: GenerateOfferCodesInput!) { generateOfferCodes(offerId: $offerId, input: $input) { id } }',
    variables: (ids) => ({ offerId: ids.offerId, input: { count: 2 } }),
  },
  {
    operation: 'removeOfferCode',
    access: edit,
    foreign: 'not-found',
    byId: true,
    document: 'mutation ($offerId: String!, $code: String!) { removeOfferCode(offerId: $offerId, code: $code) }',
    variables: (ids) => ({ offerId: ids.offerId, code: ids.code }),
  },
];
