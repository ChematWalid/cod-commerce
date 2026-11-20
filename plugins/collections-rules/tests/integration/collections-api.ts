import { COLLECTION_FIELDS } from './collections-registry';
import type { CollectionsKit } from './collections-kit';

/** A collection as the tests read it back. */
export interface CollectionResult {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly featuredAsset: { readonly id: string; readonly preview: string } | null;
  readonly mode: string;
  readonly visible: boolean;
  readonly position: number;
  readonly productCount: number;
}

export const CREATE_COLLECTION = `mutation ($input: CreateStoreCollectionInput!) {
  createStoreCollection(input: $input) { ${COLLECTION_FIELDS} }
}`;
export const UPDATE_COLLECTION = `mutation ($id: ID!, $input: UpdateStoreCollectionInput!) {
  updateStoreCollection(id: $id, input: $input) { ${COLLECTION_FIELDS} }
}`;
export const COLLECTION = `query ($id: ID!) { storeCollection(id: $id) { ${COLLECTION_FIELDS} } }`;
export const COLLECTIONS = `query ($options: StoreCollectionListInput) {
  storeCollections(options: $options) { totalItems items { ${COLLECTION_FIELDS} } }
}`;
export const DELETE_COLLECTION = 'mutation ($id: ID!) { deleteStoreCollection(id: $id) }';

/** The extensions of a GraphQL refusal the tests read. */
export interface GraphqlRefusal {
  readonly code?: string;
  readonly retryAfterSeconds?: number;
}

/** The part of a failed GraphQL call the tests read: the first error's extensions. */
export interface GraphqlErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: GraphqlRefusal }[] };
}

/** The extensions a GraphQL call was refused with; none when it succeeded. */
export async function refusalOf(call: Promise<unknown>): Promise<GraphqlRefusal | undefined> {
  try {
    await call;
    return undefined;
  } catch (error: unknown) {
    return (error as GraphqlErrorShape).response?.errors?.[0]?.extensions ?? {};
  }
}

/** The error code a GraphQL call failed with; none when it succeeded. */
export async function codeOf(call: Promise<unknown>): Promise<string | undefined> {
  return (await refusalOf(call))?.code;
}

let made = 0;

/** Creates a manual collection in the client's active store with a unique slug; any field overridden. */
export async function createCollection(
  kit: CollectionsKit,
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<CollectionResult> {
  made += 1;
  const input = {
    title: `Synthetic ${String(made)}`,
    slug: `synthetic-${String(made)}`,
    visible: true,
    position: 0,
    mode: 'manual',
    ...overrides,
  };
  const { createStoreCollection } = await kit.gql<{ createStoreCollection: CollectionResult }>(CREATE_COLLECTION, {
    input,
  });
  return createStoreCollection;
}

/** The engine id behind a GraphQL `ID` the test id strategy encodes (`T_12` → `12`), as REST carries it. */
export const rawId = (id: string): string => id.replace(/^T_/, '');
