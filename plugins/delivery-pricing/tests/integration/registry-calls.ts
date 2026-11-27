import type { StoreRestAnswer } from '@cod/testing';
import gql from 'graphql-tag';
import type { DeliveryPricingKit, GraphqlAnswer } from './delivery-pricing-kit';
import type { OperationEntry, RouteEntry, TargetIds } from './endpoint-registry';

const NO_CODE = 'NO_CODE';

/** What an operation answered: its error codes (none on success), its field and the whole answer as text. */
export interface OperationOutcome {
  readonly codes: readonly string[];
  readonly data: unknown;
  readonly text: string;
}

interface ClientErrorShape {
  readonly response?: GraphqlAnswer;
}

const codesOf = (answer: GraphqlAnswer | undefined): string[] =>
  (answer?.errors ?? []).map((error) => error.extensions?.code ?? NO_CODE);

/** Calls a registry operation aimed at `ids`: a multipart upload when the entry has a file, JSON otherwise. */
export async function callOperation(
  kit: DeliveryPricingKit,
  entry: OperationEntry,
  ids: TargetIds,
): Promise<OperationOutcome> {
  if (entry.upload !== undefined) {
    const answer = await kit.upload(entry.document, { ...entry.variables(ids) }, entry.upload());
    const body = answer.body as GraphqlAnswer;
    return { codes: codesOf(body), data: body.data?.[entry.operation] ?? null, text: answer.text };
  }
  try {
    const data = await kit.client.query<Record<string, unknown>>(gql(entry.document), { ...entry.variables(ids) });
    return { codes: [], data: data[entry.operation], text: JSON.stringify(data) };
  } catch (error: unknown) {
    const { response } = error as ClientErrorShape;
    const codes = codesOf(response);
    return { codes: codes.length === 0 ? [NO_CODE] : codes, data: null, text: JSON.stringify(response ?? null) };
  }
}

/** Calls a registry route aimed at `ids`: a raw CSV body when the entry has one, JSON otherwise. */
export function callRoute(kit: DeliveryPricingKit, entry: RouteEntry, ids: TargetIds): Promise<StoreRestAnswer> {
  if (entry.csv !== undefined) return kit.restCsv(entry.url(ids), entry.csv());
  return kit.rest(entry.method, entry.url(ids), entry.body?.());
}
