/**
 * The registry of every fee-group handler: its operation or route, permission, a call aimed at a target's ids, and
 * what another business gets back. The coverage test, the isolation sweep and the permission suite read it.
 */
import { DELIVERY_PRICING_ERROR_CODES, type PermissionKey } from '@cod/shared';
import { communeRow, groupInput, priceAdjustment } from './delivery-pricing-kit';

const D = DELIVERY_PRICING_ERROR_CODES;

/** The ids of one store a call names; the isolation sweep fills them with another store's and calls as A. */
export interface TargetIds {
  /** A group every call but the delete reads or edits. */
  readonly groupId: string;
  /** A second group, the delete's target, so a positive control does not remove the first. */
  readonly spareGroupId: string;
}

/** `null` (a read of none), `not-found` (the entry's code, 404 over REST) or `none` (the call names no id). */
export type ForeignOutcome = 'null' | 'not-found' | 'none';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  readonly notFound: string;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly route: string;
  readonly access: PermissionKey;
  /** Whether the route names a group id, so another store's id answers 404. */
  readonly byId: boolean;
  readonly url: (ids: TargetIds) => string;
  readonly body?: () => Readonly<Record<string, unknown>>;
}

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'deliveryFeeGroups',
    access: 'delivery.pricing.view',
    foreign: 'none',
    notFound: D.NOT_FOUND,
    document: 'query { deliveryFeeGroups { items { id name } totalItems } }',
    variables: () => ({}),
  },
  {
    operation: 'deliveryFeeGroup',
    access: 'delivery.pricing.view',
    foreign: 'null',
    notFound: D.NOT_FOUND,
    document: 'query ($id: String!) { deliveryFeeGroup(id: $id) { id name } }',
    variables: (ids) => ({ id: ids.groupId }),
  },
  {
    operation: 'createDeliveryFeeGroup',
    access: 'delivery.pricing.create',
    foreign: 'none',
    notFound: D.NOT_FOUND,
    document: 'mutation ($input: DeliveryFeeGroupInput!) { createDeliveryFeeGroup(input: $input) { id } }',
    variables: () => ({ input: groupInput('Created') }),
  },
  {
    operation: 'updateDeliveryFeeGroup',
    access: 'delivery.pricing.edit',
    foreign: 'not-found',
    notFound: D.NOT_FOUND,
    document:
      'mutation ($id: String!, $input: DeliveryFeeGroupInput!) { updateDeliveryFeeGroup(id: $id, input: $input) { id } }',
    variables: (ids) => ({ id: ids.groupId, input: groupInput('Updated', 650) }),
  },
  {
    operation: 'deleteDeliveryFeeGroup',
    access: 'delivery.pricing.delete',
    foreign: 'not-found',
    notFound: D.NOT_FOUND,
    document: 'mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }',
    variables: (ids) => ({ id: ids.spareGroupId }),
  },
  {
    operation: 'setDeliveryFeeCommuneRates',
    access: 'delivery.pricing.edit',
    foreign: 'not-found',
    notFound: D.NOT_FOUND,
    document: `mutation ($groupId: String!, $rows: [DeliveryFeeCommuneRateInput!]!) {
      setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: "16", rows: $rows) { id }
    }`,
    variables: (ids) => ({ groupId: ids.groupId, rows: [communeRow(1601, 450)] }),
  },
  {
    operation: 'adjustDeliveryFeeGroupPrices',
    access: 'delivery.pricing.edit',
    foreign: 'not-found',
    notFound: D.NOT_FOUND,
    document: `mutation ($groupId: String!, $input: DeliveryFeePriceAdjustmentInput!) {
      adjustDeliveryFeeGroupPrices(groupId: $groupId, input: $input) { id }
    }`,
    variables: (ids) => ({ groupId: ids.groupId, input: priceAdjustment() }),
  },
  {
    operation: 'setDeliveryFeeProvinceCommunePrices',
    access: 'delivery.pricing.edit',
    foreign: 'not-found',
    notFound: D.NOT_FOUND,
    document: `mutation ($groupId: String!, $input: DeliveryFeeCommunePricesInput!) {
      setDeliveryFeeProvinceCommunePrices(groupId: $groupId, provinceCode: "16", input: $input) { id }
    }`,
    variables: (ids) => ({ groupId: ids.groupId, input: { homePrice: 450 } }),
  },
  {
    operation: 'duplicateDeliveryFeeGroup',
    access: 'delivery.pricing.create',
    foreign: 'not-found',
    notFound: D.NOT_FOUND,
    document: 'mutation ($groupId: String!) { duplicateDeliveryFeeGroup(groupId: $groupId, name: "Copied") { id } }',
    variables: (ids) => ({ groupId: ids.groupId }),
  },
];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  { method: 'GET', route: '/delivery-fees', access: 'delivery.pricing.view', byId: false, url: () => '/delivery-fees' },
  {
    method: 'GET',
    route: '/delivery-fees/:id',
    access: 'delivery.pricing.view',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.groupId}`,
  },
  {
    method: 'POST',
    route: '/delivery-fees',
    access: 'delivery.pricing.create',
    byId: false,
    url: () => '/delivery-fees',
    body: () => groupInput('Created over REST'),
  },
  {
    method: 'PUT',
    route: '/delivery-fees/:id',
    access: 'delivery.pricing.edit',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.groupId}`,
    body: () => groupInput('Updated over REST', 650),
  },
  {
    method: 'PUT',
    route: '/delivery-fees/:id/communes/:provinceCode',
    access: 'delivery.pricing.edit',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.groupId}/communes/16`,
    body: () => ({ rows: [communeRow(1601, 450)] }),
  },
  {
    method: 'POST',
    route: '/delivery-fees/:id/adjust',
    access: 'delivery.pricing.edit',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.groupId}/adjust`,
    body: () => priceAdjustment(),
  },
  {
    method: 'PUT',
    route: '/delivery-fees/:id/communes/:provinceCode/prices',
    access: 'delivery.pricing.edit',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.groupId}/communes/16/prices`,
    body: () => ({ homePrice: 450 }),
  },
  {
    method: 'POST',
    route: '/delivery-fees/:id/duplicate',
    access: 'delivery.pricing.create',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.groupId}/duplicate`,
    body: () => ({ name: 'Copied over REST' }),
  },
  {
    method: 'DELETE',
    route: '/delivery-fees/:id',
    access: 'delivery.pricing.delete',
    byId: true,
    url: (ids) => `/delivery-fees/${ids.spareGroupId}`,
  },
];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
