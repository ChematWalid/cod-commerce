import {
  ALGER,
  ALGER_CENTRE,
  communeRow,
  CREATE_GROUP,
  feeGroupInput,
  LIST_GROUPS,
  SET_COMMUNES,
} from './delivery-pricing-operations';
import { deliveryPricingOf, type DeliveryPricingWorld } from './delivery-pricing-rows';
import { otherStore } from './endpoint-sweep';
import { fieldOf, type IsolationHttp, type MatrixRequest } from './http';
import { ownChannel } from './matrix';
import { CREATE_ROLE, SET_MEMBER_ACCESS } from './seed-operations';
import type { BusinessWorld } from './world-types';

export {
  DELIVERY_PRICING_WORLDS,
  deliveryPricingFingerprints,
  deliveryPricingOf,
  type DeliveryPricingWorld,
} from './delivery-pricing-rows';

/** The area level of the role that lets the world's member work on the delivery pricing of its one store. */
export const DELIVERY_AREA_LEVELS = [{ area: 'delivery', level: 'full' }];
/** Each business's home price and Alger-Centre override: distinct, so a quote read across businesses shows. */
const HOME_PRICES = { A: 611, B: 622 } as const;
const COMMUNE_PRICE_STEP = 50;

const UPDATE_STORE_DEFAULT = `mutation ($id: String!, $input: UpdateStoreInput!) {
  updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId }
}`;
const STORE_DEFAULT = 'query ($id: String!) { store(id: $id) { id defaultDeliveryFeeGroupId } }';
const GROUP_ROWS = `query ($id: String!) { deliveryFeeGroup(id: $id) {
  id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault updatedAt
  rates { provinceCode homePrice deskPrice deliveryEnabled deskEnabled overridden }
  communeRates { codeOns provinceCode homePrice deskPrice deliveryEnabled deskEnabled overridden }
} }`;

interface GroupSummary {
  readonly id: string;
  readonly name: string;
  readonly isPlatformDefault: boolean;
}

/** One GraphQL call of `business`'s owner on `channel` (its first store unless named), answering `field`. */
async function asOwner<T>(
  http: IsolationHttp,
  business: BusinessWorld,
  call: { readonly query: string; readonly variables?: Record<string, unknown>; readonly field: string },
  channel: NonNullable<MatrixRequest['channel']> = ownChannel(business),
): Promise<T> {
  return fieldOf(await http.graphql(business.owner, call.query, call.variables ?? {}, channel), call.field) as T;
}

/** The seeded "Platform default prices" table of the store on `channel` (created with the store, D3112). */
async function platformDefaultOn(
  http: IsolationHttp,
  business: BusinessWorld,
  channel: NonNullable<MatrixRequest['channel']>,
): Promise<string> {
  const page = await asOwner<{ items: GroupSummary[] }>(
    http,
    business,
    { query: LIST_GROUPS, field: 'deliveryFeeGroups' },
    channel,
  );
  const seeded = page.items.find((group) => group.isPlatformDefault);
  if (seeded === undefined) throw new Error(`business ${business.label}: store ${channel.label} has no seeded table`);
  return seeded.id;
}

/**
 * Gives the world's member a delivery role beside its own, still on the first store only (D2132): the
 * member-other-store cells are then refused by the store restriction, not by a missing delivery permission.
 */
async function grantPricingToMember(http: IsolationHttp, business: BusinessWorld) {
  const name = `Pricing role ${business.label} ${business.businessId}`;
  const role = await asOwner<{ id: string; name: string }>(http, business, {
    query: CREATE_ROLE,
    variables: { input: { name, areaLevels: DELIVERY_AREA_LEVELS } },
    field: 'createBusinessRole',
  });
  const access = {
    administratorId: business.member.administratorId,
    roleIds: [business.role.id, role.id],
    storeAccess: 'selected',
    storeIds: [business.stores[0].id],
  };
  await asOwner(http, business, { query: SET_MEMBER_ACCESS, variables: { input: access }, field: 'setMemberAccess' });
  return { id: role.id, name: role.name };
}

/**
 * Seeds `business`'s delivery pricing over the Admin API as its owner, on its first store: a group priced at the
 * business's home price everywhere with an Alger-Centre override, linked as the store's default (the positive control
 * of `updateStore`'s reference check), and a spare group; then reads both stores' seeded tables and gives the member
 * its delivery role.
 *
 * @throws Error when a call fails or a store has no seeded table.
 */
export async function seedDeliveryPricing(http: IsolationHttp, business: BusinessWorld): Promise<DeliveryPricingWorld> {
  const homePrice = HOME_PRICES[business.label];
  const communeHomePrice = homePrice + COMMUNE_PRICE_STEP;
  const create = (name: string) =>
    asOwner<GroupSummary>(http, business, {
      query: CREATE_GROUP,
      variables: { input: feeGroupInput(name, homePrice) },
      field: 'createDeliveryFeeGroup',
    });
  const group = await create(`Isolation pricing ${business.label} ${business.businessId}`);
  const spare = await create(`Isolation spare pricing ${business.label} ${business.businessId}`);
  await asOwner(http, business, {
    query: SET_COMMUNES,
    variables: { groupId: group.id, provinceCode: ALGER, rows: [communeRow(ALGER_CENTRE, communeHomePrice)] },
    field: 'setDeliveryFeeCommuneRates',
  });
  await asOwner(http, business, {
    query: UPDATE_STORE_DEFAULT,
    variables: { id: business.stores[0].id, input: { defaultDeliveryFeeGroupId: group.id } },
    field: 'updateStore',
  });
  return {
    groupId: group.id,
    groupName: group.name,
    spareGroupId: spare.id,
    spareGroupName: spare.name,
    platformDefaultId: await platformDefaultOn(http, business, ownChannel(business)),
    otherStoreGroupId: await platformDefaultOn(http, business, otherStore(business)),
    homePrice,
    communeHomePrice,
    pricingRole: await grantPricingToMember(http, business),
  };
}

/**
 * What `business`'s owner sees of its delivery pricing: both seeded first-store groups in full, both stores' lists and
 * defaults. The matrix's writes run in both directions, so each business's snapshot must read the same after it.
 */
export async function deliveryPricingSnapshotOf(http: IsolationHttp, business: BusinessWorld): Promise<unknown> {
  const rows = deliveryPricingOf(business);
  const read = (
    query: string,
    field: string,
    variables: Record<string, unknown> = {},
    channel = ownChannel(business),
  ) => asOwner(http, business, { query, variables, field }, channel);
  return {
    group: await read(GROUP_ROWS, 'deliveryFeeGroup', { id: rows.groupId }),
    spare: await read(GROUP_ROWS, 'deliveryFeeGroup', { id: rows.spareGroupId }),
    firstStoreList: await read(LIST_GROUPS, 'deliveryFeeGroups'),
    otherStoreList: await read(LIST_GROUPS, 'deliveryFeeGroups', {}, otherStore(business)),
    firstStoreDefault: await read(STORE_DEFAULT, 'store', { id: business.stores[0].id }),
    otherStoreDefault: await read(STORE_DEFAULT, 'store', { id: business.stores[1].id }, otherStore(business)),
  };
}
