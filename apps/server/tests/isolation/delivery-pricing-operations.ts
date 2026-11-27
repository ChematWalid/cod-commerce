import { DELIVERY_PRICING_ERROR_CODES, WILAYA_CODES } from '@cod/shared';
import { deliveryPricingOf } from './delivery-pricing-rows';
import type { SweptEndpoints, SweptOperation, SweptRoute } from './endpoint-sweep';
import type { BusinessWorld } from './world-types';

/**
 * Every delivery-pricing endpoint (plugins/delivery-pricing, P3.S1) as the P3 matrix calls it, aimed at a business's
 * first-store groups. The cells (`cases/delivery-pricing.ts`) are built from these lists, so a new endpoint is one
 * entry here. Group ids are `String` snowflakes on both surfaces, so GraphQL and REST name the same ids.
 */

const D = DELIVERY_PRICING_ERROR_CODES;
const NOT_FOUND = 404;
/** Alger, whose commune Alger-Centre ({@link ALGER_CENTRE}) the commune writes name. */
export const ALGER = '16';
export const ALGER_CENTRE = 1601;
/** The desk price every seeded and written group charges. */
const DESK_PRICE = 400;
/** What a write naming the target's groups sets, distinct from either business's seeded prices. */
const WRITTEN_HOME_PRICE = 650;
const WRITTEN_COMMUNE_PRICE = 450;

/** The groups of a business a call names. */
export interface FeeGroupTarget {
  /** The group every call but the delete reads or edits. */
  readonly groupId: string;
  /** The delete's target, so a refused delete of one group never touches the other. */
  readonly spareGroupId: string;
}

/** `business`'s first-store groups. */
export function feeGroupTargetOf(business: BusinessWorld): FeeGroupTarget {
  const rows = deliveryPricingOf(business);
  return { groupId: rows.groupId, spareGroupId: rows.spareGroupId };
}

/** A fee-group input pricing home delivery at `homePrice` in every wilaya. */
export function feeGroupInput(name: string, homePrice: number): Record<string, unknown> {
  return {
    name,
    carrierId: null,
    chargeOverweight: false,
    overweightAllowanceKg: 5,
    overweightRate: 50,
    rates: WILAYA_CODES.map((provinceCode) => ({
      provinceCode,
      homePrice,
      deskPrice: DESK_PRICE,
      deliveryEnabled: true,
      deskEnabled: true,
    })),
  };
}

/** One commune override row: a home price, everything else inherited. */
export const communeRow = (codeOns: number, homePrice: number): Record<string, unknown> => ({
  codeOns,
  homePrice,
  deskPrice: null,
  deliveryEnabled: null,
  deskEnabled: null,
});

export const LIST_GROUPS = 'query { deliveryFeeGroups { items { id name isPlatformDefault } totalItems } }';
export const CREATE_GROUP =
  'mutation ($input: DeliveryFeeGroupInput!) { createDeliveryFeeGroup(input: $input) { id name } }';
export const SET_COMMUNES = `mutation ($groupId: String!, $provinceCode: String!, $rows: [DeliveryFeeCommuneRateInput!]!) {
  setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: $provinceCode, rows: $rows) { id }
}`;

export const DELIVERY_PRICING_OPERATIONS: readonly SweptOperation<FeeGroupTarget>[] = [
  {
    name: 'deliveryFeeGroups',
    entity: 'delivery fee group',
    document: LIST_GROUPS,
    variables: () => ({}),
  },
  {
    name: 'deliveryFeeGroup',
    entity: 'delivery fee group',
    document: 'query ($id: String!) { deliveryFeeGroup(id: $id) { id name } }',
    variables: (t) => ({ id: t.groupId }),
    foreign: { kind: 'null', field: 'deliveryFeeGroup' },
  },
  {
    name: 'createDeliveryFeeGroup',
    entity: 'delivery fee group',
    document: CREATE_GROUP,
    variables: () => ({ input: feeGroupInput('Created by the matrix', WRITTEN_HOME_PRICE) }),
  },
  {
    name: 'updateDeliveryFeeGroup',
    entity: 'delivery fee group',
    document:
      'mutation ($id: String!, $input: DeliveryFeeGroupInput!) { updateDeliveryFeeGroup(id: $id, input: $input) { id } }',
    variables: (t) => ({ id: t.groupId, input: feeGroupInput('Renamed by the matrix', WRITTEN_HOME_PRICE) }),
    foreign: { kind: 'code', code: D.NOT_FOUND },
  },
  {
    name: 'deleteDeliveryFeeGroup',
    entity: 'delivery fee group',
    document: 'mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }',
    variables: (t) => ({ id: t.spareGroupId }),
    foreign: { kind: 'code', code: D.NOT_FOUND },
  },
  {
    name: 'setDeliveryFeeCommuneRates',
    entity: 'delivery fee commune rate',
    document: SET_COMMUNES,
    variables: (t) => ({
      groupId: t.groupId,
      provinceCode: ALGER,
      rows: [communeRow(ALGER_CENTRE, WRITTEN_COMMUNE_PRICE)],
    }),
    foreign: { kind: 'code', code: D.NOT_FOUND },
  },
];

const notFound = { kind: 'status', status: NOT_FOUND, code: D.NOT_FOUND } as const;

export const DELIVERY_PRICING_ROUTES: readonly SweptRoute<FeeGroupTarget>[] = [
  { method: 'GET', route: '/delivery-fees', entity: 'delivery fee group', path: () => '/delivery-fees' },
  {
    method: 'GET',
    route: '/delivery-fees/:id',
    entity: 'delivery fee group',
    path: (t) => `/delivery-fees/${t.groupId}`,
    foreign: notFound,
  },
  {
    method: 'POST',
    route: '/delivery-fees',
    entity: 'delivery fee group',
    path: () => '/delivery-fees',
    body: () => feeGroupInput('Created by the matrix over REST', WRITTEN_HOME_PRICE),
  },
  {
    method: 'PUT',
    route: '/delivery-fees/:id',
    entity: 'delivery fee group',
    path: (t) => `/delivery-fees/${t.groupId}`,
    body: () => feeGroupInput('Renamed by the matrix over REST', WRITTEN_HOME_PRICE),
    foreign: notFound,
  },
  {
    method: 'PUT',
    route: '/delivery-fees/:id/communes/:provinceCode',
    entity: 'delivery fee commune rate',
    path: (t) => `/delivery-fees/${t.groupId}/communes/${ALGER}`,
    body: () => ({ rows: [communeRow(ALGER_CENTRE, WRITTEN_COMMUNE_PRICE)] }),
    foreign: notFound,
  },
  {
    method: 'DELETE',
    route: '/delivery-fees/:id',
    entity: 'delivery fee group',
    path: (t) => `/delivery-fees/${t.spareGroupId}`,
    foreign: notFound,
  },
];

/** The delivery-pricing endpoints and their targets, for `sweepCases`. */
export const DELIVERY_PRICING_ENDPOINTS: SweptEndpoints<FeeGroupTarget> = {
  prefix: 'deliveryPricing',
  operations: DELIVERY_PRICING_OPERATIONS,
  routes: DELIVERY_PRICING_ROUTES,
  targetOf: feeGroupTargetOf,
  restTargetOf: feeGroupTargetOf,
};
