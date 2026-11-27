import { LIST_GROUPS, DELIVERY_PRICING_ENDPOINTS } from '../delivery-pricing-operations';
import { deliveryPricingOf } from '../delivery-pricing-rows';
import { otherStore, sweepCases } from '../endpoint-sweep';
import { type IsolationCase, ownerGraphql, ownerRest } from '../matrix';
import type { BusinessWorld } from '../world-types';

/**
 * The delivery-pricing cells (plugins/delivery-pricing, P3.S1): every endpoint's sweep (B's group by id, A's owner on
 * A's second store naming A's first-store group, B's store token, a store-restricted member on the store it may not
 * reach), A's own lists holding A's first-store groups only, and `updateStore` naming a fee group of B, a fee group of
 * A's other store, or any carrier id: each refused with the one pinned reference code (D3111, D3109), A's store default
 * unchanged.
 */

/** The code `updateStore` answers for any reference it may not link (D3111): foreign, other-store, unknown, carrier. */
export const STORE_REFERENCE_NOT_FOUND = 'tenancy.store-reference-not-found';
/** A well-formed snowflake no carrier holds: every carrier id is refused until P5.S1 (D3109). */
export const ANY_CARRIER_ID = '1234567890123456789';

export const UPDATE_STORE_REFERENCES = `mutation ($id: String!, $input: UpdateStoreInput!) {
  updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId }
}`;

/** A's first-store groups its own lists must hold, and its second store's table they must not. */
const ownGroupsOf = (attacker: BusinessWorld): string[] => {
  const rows = deliveryPricingOf(attacker);
  return [rows.groupId, rows.spareGroupId, rows.platformDefaultId];
};
const otherStoreGroupOf = (attacker: BusinessWorld): string[] => [deliveryPricingOf(attacker).otherStoreGroupId];

const OWN_LISTS: readonly IsolationCase[] = [
  {
    id: 'deliveryPricing.deliveryFeeGroups.own',
    entity: 'delivery fee group',
    endpoint: 'deliveryFeeGroups',
    access: 'list',
    title: "A's owner lists A1's pricing options: A1's groups only, never B's or A2's",
    request: (a) => ownerGraphql(a, LIST_GROUPS),
    expect: { kind: 'own', mustInclude: ownGroupsOf, mustExclude: otherStoreGroupOf },
    reverse: true,
  },
  {
    id: 'deliveryPricing.get-/delivery-fees.own',
    entity: 'delivery fee group',
    endpoint: 'GET /delivery-fees',
    access: 'list',
    title: "A's owner lists A1's pricing options over REST: A1's groups only, never B's or A2's",
    request: (a) => ownerRest(a, 'GET', '/delivery-fees'),
    expect: { kind: 'own', mustInclude: ownGroupsOf, mustExclude: otherStoreGroupOf },
    reverse: true,
  },
];

const refused = { kind: 'code', code: STORE_REFERENCE_NOT_FOUND } as const;

const STORE_REFERENCES: readonly IsolationCase[] = [
  {
    id: 'tenancy.updateStore.foreign-fee-group',
    entity: 'store',
    endpoint: 'updateStore(input.defaultDeliveryFeeGroupId)',
    access: 'write',
    title: "A's owner makes B's pricing option A1's default (#230): refused, A1 keeps its default",
    request: (a, b) =>
      ownerGraphql(a, UPDATE_STORE_REFERENCES, {
        id: a.stores[0].id,
        input: { defaultDeliveryFeeGroupId: deliveryPricingOf(b).groupId },
      }),
    expect: refused,
    reverse: true,
  },
  {
    id: 'tenancy.updateStore.other-store-fee-group',
    entity: 'store',
    endpoint: 'updateStore(input.defaultDeliveryFeeGroupId)',
    access: 'write',
    title: "A's owner makes A1's pricing option A2's default: refused, a group belongs to its own store (D3111)",
    request: (a) =>
      ownerGraphql(
        a,
        UPDATE_STORE_REFERENCES,
        { id: a.stores[1].id, input: { defaultDeliveryFeeGroupId: deliveryPricingOf(a).groupId } },
        otherStore(a),
      ),
    expect: refused,
    reverse: true,
  },
  {
    id: 'tenancy.updateStore.carrier',
    entity: 'store',
    endpoint: 'updateStore(input.defaultCarrierId)',
    access: 'write',
    title: "A's owner sets a default carrier on A1 (#153): refused, no carrier exists before P5.S1 (D3109)",
    request: (a) =>
      ownerGraphql(a, UPDATE_STORE_REFERENCES, { id: a.stores[0].id, input: { defaultCarrierId: ANY_CARRIER_ID } }),
    expect: refused,
    reverse: true,
  },
];

export const DELIVERY_PRICING_CASES: readonly IsolationCase[] = [
  ...sweepCases(DELIVERY_PRICING_ENDPOINTS),
  ...OWN_LISTS,
  ...STORE_REFERENCES,
];
