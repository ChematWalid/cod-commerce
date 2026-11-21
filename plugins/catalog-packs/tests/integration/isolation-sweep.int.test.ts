import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, rawTestId } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIds,
} from './endpoint-registry';
import { PACK, type PackResult, packInput, packsSuite, SAVE_PACK } from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const MALFORMED_IDS = ['abc', '-1', '99999999999999999999', ''];
/** Text no answer may carry: SQL, entity names, stacks, B's price (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /catalog_pack/, /EntityNotFound/, /4321/];
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

function expectForeign(entry: { foreign?: string; notFound: string }, outcome: Outcome): void {
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  else expect(outcome.code).toBe(entry.notFound);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

/** B's pack (components 4 000 and 1 000 at 4 321 fixed) and its ids, GraphQL and REST spellings. */
async function packOfB(): Promise<{ graphql: TargetIds; rest: TargetIds }> {
  await suite.kit.asOwner(suite.fixtures.b);
  const one = await suite.kit.createProduct({ title: 'B one', price: 4000 });
  const two = await suite.kit.createProduct({ title: 'B two', price: 1000 });
  const pack = await suite.kit.createPackProduct('B pack');
  const input = packInput([one.id, two.id], {
    packPricingMode: 'fixed',
    packFixedPrice: 4321,
    packDiscountType: null,
    packDiscountValue: null,
  });
  await suite.kit.gql(SAVE_PACK, { id: pack.id, input });
  const graphql = { productId: pack.id, componentId: one.id, otherComponentId: two.id };
  return {
    graphql,
    rest: { productId: rawTestId(pack.id), componentId: rawTestId(one.id), otherComponentId: rawTestId(two.id) },
  };
}

describe('pack isolation sweep (two businesses)', () => {
  let idsOfB: TargetIds;
  let restIdsOfB: TargetIds;

  beforeAll(async () => {
    ({ graphql: idsOfB, rest: restIdsOfB } = await packOfB());
  });

  it.each(OPERATION_REGISTRY)("$operation as A against B's ids answers $foreign", async (entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, idsOfB);

    // Assert
    expectForeign(entry, outcome);
  });

  it.each(ROUTE_REGISTRY)("$method $route as A against B's ids answers 404", async (entry: RouteEntry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(restIdsOfB), entry.body?.(restIdsOfB));

    // Assert
    expect(answer.status).toBe(404);
    expectForeign(entry, {
      code: (answer.body as { code?: string } | null)?.code,
      data: answer.body,
      text: answer.text,
    });
  });

  it.each(
    OPERATION_REGISTRY.filter((entry) => entry.byId).flatMap((entry) =>
      MALFORMED_IDS.map((id) => [entry.operation, id, entry] as const),
    ),
  )('%s answers not found for the malformed id "%s"', async (_operation, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, { ...idsOfB, productId: id });

    // Assert
    expectForeign(entry, outcome);
  });

  it.each(
    ROUTE_REGISTRY.filter((entry) => entry.route.includes(':productId')).flatMap((entry) =>
      MALFORMED_IDS.filter((id) => id !== '').map((id) => [entry.method, entry.route, id, entry] as const),
    ),
  )('%s %s answers 404 for the malformed id "%s"', async (_method, _route, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest(
      entry.method,
      entry.url({ ...restIdsOfB, productId: encodeURIComponent(id) }),
      entry.body?.(restIdsOfB),
    );

    // Assert
    expect(answer.status).toBe(404);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
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

  it('serves B its own pack (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const { catalogPack } = await suite.kit.gql<{ catalogPack: PackResult | null }>(PACK, { id: idsOfB.productId });

    // Assert
    expect(catalogPack).toMatchObject({ productId: idsOfB.productId, price: 4321 });
  });

  it("answers not found from A's second store against a pack of its first store", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const one = await suite.kit.createProduct({ title: 'A one', price: 10 });
    const two = await suite.kit.createProduct({ title: 'A two', price: 20 });
    const pack = await suite.kit.createPackProduct('A pack');
    await suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([one.id, two.id]) });
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const { catalogPack } = await suite.kit.gql<{ catalogPack: PackResult | null }>(PACK, { id: pack.id });
    const answer = await suite.kit.rest(
      'PUT',
      `/catalog/packs/${rawTestId(pack.id)}`,
      packInput([rawTestId(one.id), rawTestId(two.id)]),
    );

    // Assert
    expect(catalogPack).toBeNull();
    expect(answer.status).toBe(404);
  });
});
