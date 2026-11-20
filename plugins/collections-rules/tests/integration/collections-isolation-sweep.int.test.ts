import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  COLLECTION,
  type CollectionResult,
  createCollection,
  DELETE_COLLECTION,
  type GraphqlErrorShape,
  rawId,
} from './collections-api';
import { collectionsSuite } from './collections-kit';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIdField,
  type TargetIds,
} from './collections-registry';

const suite = collectionsSuite(1017, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NOT_FOUND = COLLECTIONS_ERROR_CODES.NOT_FOUND;
const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999', ''];
/**
 * Text no answer may carry: SQL, Vendure entity names and their not-found text, stacks (D2136). The plain word
 * "Collection" is in our own operation names and the translated not-found message, so the entity names are matched.
 */
const LEAKS = [
  /select /i,
  /QueryFailedError/,
  /CollectionTranslation/,
  /EntityNotFound/,
  /No Collection with/,
  /\s+at /,
];
const NO_CODE = 'NO_CODE';
const UNKNOWN_CHANNEL = 'an unknown token';
/** The channels A is not a member of; every handler, read or write, must refuse A there. */
const WRONG_CHANNEL_TOKENS = {
  "B's channel": (): string => suite.fixtures.b.stores[0].channelToken,
  'the default channel': (): string => PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  [UNKNOWN_CHANNEL]: (): string => 'synthetic-unknown-channel-token',
} as const;
type WrongChannel = keyof typeof WRONG_CHANNEL_TOKENS;
const WRONG_CHANNELS = Object.keys(WRONG_CHANNEL_TOKENS) as WrongChannel[];

interface Outcome {
  readonly code: string | undefined;
  readonly data: unknown;
  readonly text: string;
}

async function callOperation(entry: OperationEntry, ids: TargetIds): Promise<Outcome> {
  try {
    const data = await suite.kit.client.query<Record<string, unknown>>(gql(entry.document), entry.variables(ids));
    return { code: undefined, data: data[entry.operation], text: JSON.stringify(data) };
  } catch (error: unknown) {
    const { response } = error as GraphqlErrorShape;
    return {
      code: response?.errors?.[0]?.extensions?.code ?? NO_CODE,
      data: null,
      text: JSON.stringify(response ?? null),
    };
  }
}

/** How many definitions a store holds, read past the API so a refused write that slipped through shows. */
async function definitionsInStore(storeId: string): Promise<number> {
  const [row] = await suite.kit.query<{ count: string }>(
    'SELECT count(*) AS count FROM collections_definition WHERE "storeId" = $1',
    [storeId],
  );
  return Number(row?.count);
}

const fieldOf = (entry: { idField?: TargetIdField }): TargetIdField => entry.idField ?? 'collectionId';

/** A's own outcome must not hold the target's row: null, not found, or an answer about A's store only. */
function expectForeign(entry: OperationEntry | RouteEntry, outcome: Outcome, ids: TargetIds): void {
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  if (entry.foreign === 'not-found') expect(outcome.code).toBe(NOT_FOUND);
  if (entry.foreign === 'own-only') expect(outcome.text).not.toContain(`"${ids[fieldOf(entry)]}"`);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

async function callRoute(entry: RouteEntry, ids: TargetIds): Promise<Outcome & { status: number }> {
  const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));
  const code = (answer.body as { code?: string } | null)?.code;
  return { status: answer.status, code: answer.status < 400 ? undefined : code, data: answer.body, text: answer.text };
}

describe('collections isolation sweep (two businesses)', () => {
  let ofB: CollectionResult;
  let idsOfB: TargetIds;
  let restIdsOfB: TargetIds;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.b);
    ofB = await createCollection(suite.kit, { title: 'B only', slug: 'b-only' });
    idsOfB = { collectionId: ofB.id };
    restIdsOfB = { collectionId: rawId(ofB.id) };
  });

  it.each(OPERATION_REGISTRY)("$operation as A against B's ids answers $foreign", async (entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, idsOfB);

    // Assert
    expectForeign(entry, outcome, idsOfB);
  });

  it.each(ROUTE_REGISTRY)("$method $route as A against B's ids answers $foreign", async (entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callRoute(entry, restIdsOfB);

    // Assert
    expectForeign(entry, outcome, restIdsOfB);
    if (entry.foreign === 'not-found') expect(outcome.status).toBe(404);
  });

  it.each(
    OPERATION_REGISTRY.filter((entry) => entry.byId).flatMap((entry) =>
      MALFORMED_IDS.map((id) => [entry.operation, id, entry] as const),
    ),
  )('%s answers like a foreign id for the malformed id "%s"', async (_operation, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, { ...idsOfB, [fieldOf(entry)]: id });

    // Assert
    expectForeign(entry, outcome, idsOfB);
  });

  it.each(
    ROUTE_REGISTRY.filter((entry) => entry.byId).flatMap((entry) =>
      MALFORMED_IDS.filter((id) => id !== '').map((id) => [entry.method, entry.route, id, entry] as const),
    ),
  )('%s %s answers 404 for the malformed id "%s"', async (_method, _route, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callRoute(entry, { ...restIdsOfB, [fieldOf(entry)]: encodeURIComponent(id) });

    // Assert
    expect(outcome.status).toBe(404);
    for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
  });

  it.each(
    OPERATION_REGISTRY.flatMap((entry) => WRONG_CHANNELS.map((channel) => [entry.operation, channel, entry] as const)),
  )('%s as A on %s is refused', async (_operation, channel, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(WRONG_CHANNEL_TOKENS[channel]());

    // Act
    const outcome = await callOperation(entry, idsOfB);

    // Assert
    expect(outcome.code).toBe(channel === UNKNOWN_CHANNEL ? 'CHANNEL_NOT_FOUND' : 'FORBIDDEN');
    expect(outcome.text).not.toContain(`"${idsOfB.collectionId}"`);
    for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
  });

  it.each(
    ROUTE_REGISTRY.flatMap((entry) =>
      WRONG_CHANNELS.map((channel) => [entry.method, entry.route, channel, entry] as const),
    ),
  )('%s %s as A on %s is refused', async (_method, _route, channel, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(WRONG_CHANNEL_TOKENS[channel]());

    // Act
    const outcome = await callRoute(entry, restIdsOfB);

    // Assert
    if (channel === UNKNOWN_CHANNEL) {
      expect(outcome.status).toBe(404);
      expect(outcome.code).toBe('CHANNEL_NOT_FOUND');
    } else {
      expect(outcome.status).toBe(403);
    }
    expect(outcome.text).not.toContain(`"${restIdsOfB.collectionId}"`);
    for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
  });

  it("leaves B's store unchanged and serves its collection to B (positive control)", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const { storeCollection } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: ofB.id,
    });
    const inStoreOfB = await definitionsInStore(suite.fixtures.b.stores[0].id);

    // Assert
    expect(storeCollection).toMatchObject({ id: ofB.id, title: 'B only', slug: 'b-only', visible: true, position: 0 });
    expect(inStoreOfB).toBe(1);
  });
});

describe('slugs of two businesses (D2319: a slug is unique within one store)', () => {
  const SLUG_OF_B = 'b-slug-only';
  /** Arabic letters with no NFD decomposition, so the stored slug is the typed one. */
  const ARABIC_SLUG_OF_B = 'ملابس-صيفية';

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.b);
    await createCollection(suite.kit, { slug: SLUG_OF_B });
    await createCollection(suite.kit, { slug: ARABIC_SLUG_OF_B });
  });

  it.each([SLUG_OF_B, ARABIC_SLUG_OF_B])(
    'A gets B\'s slug "%s" unchanged over GraphQL and REST, neither refused nor suffixed',
    async (slug) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const overGraphql = await createCollection(suite.kit, { slug });
      await suite.kit.gql(DELETE_COLLECTION, { id: overGraphql.id });
      const overRest = await suite.kit.rest('POST', '/catalog/collections', {
        title: 'Same slug as B',
        slug,
        visible: true,
        position: 0,
        mode: 'manual',
      });
      await suite.kit.rest('DELETE', `/catalog/collections/${(overRest.body as { id: string }).id}`);

      // Assert
      expect(overGraphql.slug).toBe(slug);
      expect(overRest).toMatchObject({ status: 201, body: { slug } });
    },
  );
});
