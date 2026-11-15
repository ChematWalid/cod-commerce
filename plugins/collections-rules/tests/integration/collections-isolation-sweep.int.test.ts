import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { COLLECTION, type CollectionResult, createCollection, rawId } from './collections-api';
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

interface Outcome {
  readonly code: string | undefined;
  readonly data: unknown;
  readonly text: string;
}

interface ClientErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[] };
}

async function callOperation(entry: OperationEntry, ids: TargetIds): Promise<Outcome> {
  try {
    const data = await suite.kit.client.query<Record<string, unknown>>(gql(entry.document), entry.variables(ids));
    return { code: undefined, data: data[entry.operation], text: JSON.stringify(data) };
  } catch (error: unknown) {
    const { response } = error as ClientErrorShape;
    return {
      code: response?.errors?.[0]?.extensions?.code ?? NO_CODE,
      data: null,
      text: JSON.stringify(response ?? null),
    };
  }
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

  it.each([
    ["B's channel", (): string => suite.fixtures.b.stores[0].channelToken, 'FORBIDDEN'],
    ['the default channel', (): string => PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, 'FORBIDDEN'],
    ['an unknown token', (): string => 'synthetic-unknown-channel-token', 'CHANNEL_NOT_FOUND'],
  ] as const)('refuses A on %s', async (_name, token, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(token());

    // Act
    const outcome = await callOperation(OPERATION_REGISTRY[0] as OperationEntry, idsOfB);

    // Assert
    expect(outcome.code).toBe(code);
  });

  it.each([
    ["B's channel", (): string => suite.fixtures.b.stores[0].channelToken, 403, undefined],
    ['the default channel', (): string => PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, 403, undefined],
    ['an unknown token', (): string => 'synthetic-unknown-channel-token', 404, 'CHANNEL_NOT_FOUND'],
  ] as const)('refuses A on %s over REST', async (_name, token, status, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(token());

    // Act
    const answer = await suite.kit.rest('GET', '/catalog/collections');

    // Assert
    expect(answer.status).toBe(status);
    if (code !== undefined) expect(answer.body).toMatchObject({ code });
    expect(answer.text).not.toContain(`"${restIdsOfB.collectionId}"`);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });

  it("leaves B's collection unchanged and serves it to B (positive control)", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const { storeCollection } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: ofB.id,
    });

    // Assert
    expect(storeCollection).toMatchObject({ id: ofB.id, title: 'B only', visible: true });
  });
});
