import type { GenerateCodesInput } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { OFFER_CODES_QUERY_KEY } from './constants';
import { mutateForStore } from './editor-queries';
import type { CodeInput } from './model/code-inputs';
import { type StoreScope, storeQuery } from './queries';

/** A code of an offer as `offerCodes` answers it (`OfferCodeView`). */
export interface OfferCodeDto {
  readonly id: string;
  readonly code: string;
  readonly usageLimit: number | null;
  readonly usageCount: number;
}

const CODE_FIELDS = 'id code usageLimit usageCount';
const CODES_QUERY = `query OfferCodes($offerId: String!) { offerCodes(offerId: $offerId) { ${CODE_FIELDS} } }`;
const ADD_MUTATION = `mutation OfferCodesAdd($offerId: String!, $codes: [OfferCodeInput!]!) {
  addOfferCodes(offerId: $offerId, codes: $codes) { ${CODE_FIELDS} } }`;
const GENERATE_MUTATION = `mutation OfferCodesGenerate($offerId: String!, $input: GenerateOfferCodesInput!) {
  generateOfferCodes(offerId: $offerId, input: $input) { ${CODE_FIELDS} } }`;
const REMOVE_MUTATION = `mutation OfferCodeRemove($offerId: String!, $code: String!) {
  removeOfferCode(offerId: $offerId, code: $code) }`;

/** The codes of a saved offer of `scope`'s store, oldest first; nothing is asked for an unsaved offer. */
export function useOfferCodes(scope: StoreScope | null, offerId: string | null) {
  return useQuery({
    ...storeQuery(
      OFFER_CODES_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly offerCodes: readonly OfferCodeDto[] }>(CODES_QUERY, { offerId })).offerCodes,
      { offerId },
    ),
    enabled: offerId !== null,
  });
}

/** Adds one typed code to the offer (D2406: stored trimmed and upper-cased, unique per store). */
export const addOfferCode = async (scope: StoreScope | null, offerId: string, code: CodeInput): Promise<unknown> =>
  mutateForStore(scope, ADD_MUTATION, { offerId, codes: [code] });

/** Draws `input.count` random codes for the offer (D2512). */
export const generateOfferCodes = async (
  scope: StoreScope | null,
  offerId: string,
  input: GenerateCodesInput,
): Promise<unknown> => mutateForStore(scope, GENERATE_MUTATION, { offerId, input });

/** Removes one code of the offer; its past uses stay counted on the orders. */
export const removeOfferCode = async (scope: StoreScope | null, offerId: string, code: string): Promise<unknown> =>
  mutateForStore(scope, REMOVE_MUTATION, { offerId, code });
