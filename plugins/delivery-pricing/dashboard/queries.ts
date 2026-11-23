import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';
import { readRequestToken, sendForStore, type StoreScope, storeQuery } from '@cod/plugin-merchant-shell/shell-api';
import {
  type DeliveryFeeCommuneRatesInput,
  type DeliveryFeeGroupInput,
  FEE_GROUP_LIST_MAX_TAKE,
  type Province,
  type Town,
  type WilayaCode,
} from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  FEE_GROUP_QUERY_KEY,
  FEE_GROUPS_QUERY_KEY,
  PRICING_TEMPLATE_QUERY_KEY,
  PROVINCE_BY_CODE_ENDPOINT,
  TOWNS_QUERY_KEY,
} from './constants';
import type { FeeGroupDto, FeeGroupPageDto } from './dto';
import { listInputOf, type PricingListQuery } from './model/list-view';
import { findPlatformDefaultId } from './model/template';

const RATE_FIELDS =
  'provinceCode homePrice deskPrice baseHomePrice baseDeskPrice deliveryEnabled deskEnabled overridden';
const COMMUNE_FIELDS = `codeOns provinceCode homePrice deskPrice baseHomePrice baseDeskPrice deliveryEnabled
  deskEnabled overridden`;
/** Every field of a fee group the editor reads. */
const GROUP_FIELDS = `id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault
  createdAt updatedAt rates { ${RATE_FIELDS} } communeRates { ${COMMUNE_FIELDS} }`;

const LIST_QUERY = `query DeliveryFeeGroupList($options: DeliveryFeeGroupListInput) {
  deliveryFeeGroups(options: $options) { items { id name carrierId isPlatformDefault createdAt } totalItems } }`;
const ONE_QUERY = `query DeliveryFeeGroupEditor($id: String!) { deliveryFeeGroup(id: $id) { ${GROUP_FIELDS} } }`;
const CREATE_MUTATION = `mutation DeliveryFeeGroupCreate($input: DeliveryFeeGroupInput!) {
  createDeliveryFeeGroup(input: $input) { ${GROUP_FIELDS} } }`;
const UPDATE_MUTATION = `mutation DeliveryFeeGroupUpdate($id: String!, $input: DeliveryFeeGroupInput!) {
  updateDeliveryFeeGroup(id: $id, input: $input) { ${GROUP_FIELDS} } }`;
const DELETE_MUTATION = 'mutation DeliveryFeeGroupDelete($id: String!) { deleteDeliveryFeeGroup(id: $id) }';
const COMMUNES_MUTATION = `mutation DeliveryFeeCommunesSet($groupId: String!, $provinceCode: String!,
  $rows: [DeliveryFeeCommuneRateInput!]!) {
  setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: $provinceCode, rows: $rows) { ${GROUP_FIELDS} } }`;

/** A write sent only while requests go to `scope`'s store; the answer's shape is the document's. */
async function mutate<T>(scope: StoreScope | null, document: string, variables: object): Promise<T> {
  return (await sendForStore(scope?.channelToken ?? null, readRequestToken, () =>
    api.mutate(document, variables),
  )) as T;
}

const fetchGroup = async (id: string): Promise<FeeGroupDto | null> =>
  (await api.query<{ readonly deliveryFeeGroup: FeeGroupDto | null }>(ONE_QUERY, { id })).deliveryFeeGroup;

const fetchPage = async (options: object): Promise<FeeGroupPageDto> =>
  (await api.query<{ readonly deliveryFeeGroups: FeeGroupPageDto }>(LIST_QUERY, { options })).deliveryFeeGroups;

/** One page of the active store's pricing options, newest first, searched by name. */
export function useFeeGroups(scope: StoreScope | null, query: PricingListQuery) {
  const options = listInputOf(query);
  return useQuery(storeQuery(FEE_GROUPS_QUERY_KEY, scope, () => fetchPage(options), options));
}

/** The pricing option the editor opens, `null` when the active store has no such option. */
export function useFeeGroup(scope: StoreScope | null, groupId: string) {
  return useQuery(storeQuery(FEE_GROUP_QUERY_KEY, scope, () => fetchGroup(groupId), { groupId }));
}

/** The store's "Platform default prices" table, which a new pricing option starts from (D3138); null when missing. */
export function usePricingTemplate(scope: StoreScope | null) {
  return useQuery(
    storeQuery(PRICING_TEMPLATE_QUERY_KEY, scope, async () => {
      const id = await findPlatformDefaultId((skip, take) => fetchPage({ skip, take }), FEE_GROUP_LIST_MAX_TAKE);
      return id === null ? null : fetchGroup(id);
    }),
  );
}

/** The communes of a wilaya, from the public reference data (`GET /provinces/code/:code`, D3117). */
export function useTowns(provinceCode: WilayaCode) {
  return useQuery({
    queryKey: [...TOWNS_QUERY_KEY, provinceCode],
    queryFn: async (): Promise<readonly Town[]> => {
      const response = await fetch(`${getApiBaseUrl()}${PROVINCE_BY_CODE_ENDPOINT}${provinceCode}`);
      if (!response.ok) throw new Error(`The communes of ${provinceCode} answered ${String(response.status)}`);
      return ((await response.json()) as Province).towns ?? [];
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Creates a pricing option in `scope`'s store. */
export const createFeeGroup = async (scope: StoreScope | null, input: DeliveryFeeGroupInput): Promise<FeeGroupDto> =>
  (await mutate<{ readonly createDeliveryFeeGroup: FeeGroupDto }>(scope, CREATE_MUTATION, { input }))
    .createDeliveryFeeGroup;

/** Saves the settings and the wilaya rows of a pricing option; its commune rows stay as they are. */
export const updateFeeGroup = async (
  scope: StoreScope | null,
  id: string,
  input: DeliveryFeeGroupInput,
): Promise<FeeGroupDto> =>
  (await mutate<{ readonly updateDeliveryFeeGroup: FeeGroupDto }>(scope, UPDATE_MUTATION, { id, input }))
    .updateDeliveryFeeGroup;

/** Deletes a pricing option; the store's default and the platform default table are refused (D3108). */
export const deleteFeeGroup = async (scope: StoreScope | null, id: string): Promise<boolean> =>
  (await mutate<{ readonly deleteDeliveryFeeGroup: boolean }>(scope, DELETE_MUTATION, { id })).deleteDeliveryFeeGroup;

/** Merges the communes of one wilaya into a pricing option (D3125). */
export const setCommuneRates = async (
  scope: StoreScope | null,
  groupId: string,
  input: DeliveryFeeCommuneRatesInput,
): Promise<FeeGroupDto> =>
  (await mutate<{ readonly setDeliveryFeeCommuneRates: FeeGroupDto }>(scope, COMMUNES_MUTATION, { groupId, ...input }))
    .setDeliveryFeeCommuneRates;
