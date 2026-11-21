import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { PRICING_ERROR_CODES } from '@cod/shared';
import { type BusinessFixture, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  idFieldOf,
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIds,
} from './endpoint-registry';
import { OFFER_PERMISSIONS } from '../../api/permissions';
import { aDraftWithACode, offersApiSuite } from './offers-api-kit';

/** One snowflake worker id per offers integration file (D2433, D2525). */
const SNOWFLAKE_WORKER_ID = 976;

const suite = offersApiSuite(SNOWFLAKE_WORKER_ID, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NOT_FOUND = PRICING_ERROR_CODES.OFFER_NOT_FOUND;
const NOT_FOUND_STATUS = 404;
const REST_STATUS: Readonly<Record<string, number>> = { 'not-found': NOT_FOUND_STATUS, 'unknown-target': 422 };
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const OK_STATUS = 200;
const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999', ''];
/** Text no answer may carry: SQL, entity names, stack frames (D2520). */
const LEAKS = [/select /i, /QueryFailedError/, /Offer\w*Entity/, /EntityNotFound/, /\.ts:\d+:\d+/];
const NO_CODE = 'NO_CODE';
/** The code both businesses hold on their own offer (D2528). */
const SHARED_CODE = 'SAME10';
const ORIGINAL_TITLE = 'Two pieces';

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
    const code = response?.errors?.[0]?.extensions?.code ?? NO_CODE;
    return { code, data: null, text: JSON.stringify(response ?? null) };
  }
}

/** A REST call of `entry` on `ids`, as an outcome: a code only for a refusal. */
async function callRoute(entry: RouteEntry, ids: TargetIds): Promise<Outcome & { status: number }> {
  const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));
  const code = (answer.body as { code?: string } | null)?.code;
  const text = JSON.stringify(answer.body);
  return { status: answer.status, code: answer.status < 400 ? undefined : (code ?? NO_CODE), data: answer.body, text };
}

/** Outcomes that answer the caller successfully: an error must never pass as isolation. */
const SUCCEEDS: ReadonlySet<string> = new Set(['own-only', 'no-read']);

/**
 * The caller's outcome must not hold the target's row: null, not found, an answer about its own store only, one read
 * from the input alone, or a create refused because the target's variant is no row of the caller's store (D2537).
 */
function expectForeign(entry: OperationEntry | RouteEntry, outcome: Outcome, ids: TargetIds): void {
  if (SUCCEEDS.has(entry.foreign)) expect(outcome.code).toBeUndefined();
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  if (entry.foreign === 'not-found') expect(outcome.code).toBe(NOT_FOUND);
  if (entry.foreign === 'own-only') expect(outcome.text).not.toContain(`"${ids[idFieldOf(entry)]}"`);
  if (entry.foreign === 'unknown-target') expect(outcome.code).toBe(PRICING_ERROR_CODES.UNKNOWN_TARGETS);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

const OFFER_BY_ID = OPERATION_REGISTRY.find((entry) => entry.operation === 'offer') as OperationEntry;
const byIdRoutes = ROUTE_REGISTRY.filter((entry) => entry.route.includes(':id'));
const OFFER_STATE = 'query ($id: String!) { offer(id: $id) { id status title version codeCount } }';
const CODES_STATE = 'query ($offerId: String!) { offerCodes(offerId: $offerId) { code } }';

/** The offer's row and its code list as its owner reads them: code writes never bump the offer's version. */
async function stateOf(offerId: string): Promise<unknown> {
  const { offer } = await suite.kit.gql<{ offer: unknown }>(OFFER_STATE, { id: offerId });
  const { offerCodes } = await suite.kit.gql<{ offerCodes: { code: string }[] }>(CODES_STATE, { offerId });
  return { offer, codes: offerCodes.map((entry) => entry.code) };
}

/** A draft as `aDraftWithACode` made it, untouched. */
const untouched = (offerId: string, code: string): unknown => ({
  offer: { id: offerId, status: 'draft', title: ORIGINAL_TITLE, version: 1, codeCount: 1 },
  codes: [code],
});

describe('offers isolation sweep (two businesses)', () => {
  const idsOf = new Map<BusinessFixture, TargetIds>();

  beforeAll(async () => {
    const { a, b } = suite.fixtures;
    idsOf.set(a, await aDraftWithACode(suite, a, a.stores[0], SHARED_CODE));
    idsOf.set(b, await aDraftWithACode(suite, b, b.stores[0], SHARED_CODE));
  });

  const directions = [
    ['A', 'B', () => suite.fixtures.a, () => suite.fixtures.b],
    ['B', 'A', () => suite.fixtures.b, () => suite.fixtures.a],
  ] as const;

  describe.each(directions)('as %s against %s', (_caller, _target, callerOf, targetOf) => {
    const target = (): TargetIds => idsOf.get(targetOf()) as TargetIds;

    it.each(OPERATION_REGISTRY)("$operation against the other business's ids answers $foreign", async (entry) => {
      // Arrange
      await suite.kit.asOwner(callerOf());

      // Act
      const outcome = await callOperation(entry, target());

      // Assert
      expectForeign(entry, outcome, target());
    });

    it.each(ROUTE_REGISTRY)("$method $route against the other business's ids answers $foreign", async (entry) => {
      // Arrange
      await suite.kit.asOwner(callerOf());

      // Act
      const outcome = await callRoute(entry, target());

      // Assert
      expectForeign(entry, outcome, target());
      if (entry.foreign in REST_STATUS) expect(outcome.status).toBe(REST_STATUS[entry.foreign]);
    });

    it("never lists the other business's offer, even filtered by its product", async () => {
      // Arrange
      await suite.kit.asOwner(callerOf());

      // Act
      const { offers } = await suite.kit.gql<{ offers: { items: { id: string }[] } }>(
        'query { offers(options: { take: 50 }) { items { id } } }',
      );

      // Assert
      expect(offers.items.map((offer) => offer.id)).not.toContain(target().offerId);
      expect(offers.items.map((offer) => offer.id)).toContain(idsOf.get(callerOf())?.offerId);
    });
  });

  it.each(
    OPERATION_REGISTRY.filter((entry) => entry.byId).flatMap((entry) =>
      MALFORMED_IDS.map((id) => [entry.operation, entry.foreign, id, entry] as const),
    ),
  )('%s answers %s for the malformed id "%s"', async (_operation, _foreign, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const ids = idsOf.get(suite.fixtures.b) as TargetIds;

    // Act
    const outcome = await callOperation(entry, { ...ids, [idFieldOf(entry)]: id });

    // Assert
    expectForeign(entry, outcome, ids);
  });

  it.each(
    byIdRoutes.flatMap((entry) =>
      MALFORMED_IDS.filter((id) => id !== '').map((id) => [entry.method, entry.route, id, entry] as const),
    ),
  )('%s %s answers 404 for the malformed id "%s"', async (_method, _route, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const ids = idsOf.get(suite.fixtures.b) as TargetIds;

    // Act
    const outcome = await callRoute(entry, { ...ids, [idFieldOf(entry)]: encodeURIComponent(id) });

    // Assert
    expect(outcome.status).toBe(NOT_FOUND_STATUS);
    for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
  });

  it.each([
    ["B's channel", (): string => suite.fixtures.b.stores[0].channelToken, FORBIDDEN],
    ['the default channel', (): string => PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, FORBIDDEN],
    ['an unknown token', (): string => 'synthetic-unknown-channel-token', 'CHANNEL_NOT_FOUND'],
  ] as const)('refuses A on %s', async (_name, token, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(token());

    // Act
    const outcome = await callOperation(
      OPERATION_REGISTRY[0] as OperationEntry,
      idsOf.get(suite.fixtures.b) as TargetIds,
    );

    // Assert
    expect(outcome.code).toBe(code);
  });

  it.each([
    ['A', () => suite.fixtures.a],
    ['B', () => suite.fixtures.b],
  ] as const)("leaves %s's offer and its codes unchanged after the other business's calls", async (_name, business) => {
    // Arrange
    await suite.kit.asOwner(business());
    const ids = idsOf.get(business()) as TargetIds;

    // Act
    const state = await stateOf(ids.offerId);

    // Assert
    expect(state).toEqual(untouched(ids.offerId, SHARED_CODE));
  });

  describe("A's other store (store isolation inside one business)", () => {
    let inFirst: TargetIds;
    let inSecond: TargetIds;

    beforeAll(async () => {
      const { a } = suite.fixtures;
      inFirst = await aDraftWithACode(suite, a, a.stores[0], 'FIRST10');
      inSecond = await aDraftWithACode(suite, a, a.stores[1], 'SECOND10');
    });

    it.each(OPERATION_REGISTRY.filter((entry) => entry.byId))(
      "$operation from A's second store against its first store's offer answers $foreign",
      async (entry) => {
        // Arrange
        const { a } = suite.fixtures;
        await suite.kit.asOwner(a, a.stores[1]);

        // Act
        const outcome = await callOperation(entry, inFirst);

        // Assert
        expectForeign(entry, outcome, inFirst);
      },
    );

    it.each(byIdRoutes)(
      "$method $route from A's second store against its first store's offer answers 404",
      async (entry) => {
        // Arrange
        const { a } = suite.fixtures;
        await suite.kit.asOwner(a, a.stores[1]);

        // Act
        const outcome = await callRoute(entry, inFirst);

        // Assert
        expect(outcome).toMatchObject({ status: NOT_FOUND_STATUS, code: NOT_FOUND });
      },
    );

    it("serves a member restricted to A's first store that store's offers (positive control)", async () => {
      // Arrange
      const { a } = suite.fixtures;
      await suite.kit.signInAsMember(a, [OFFER_PERMISSIONS.view], [a.stores[0]]);

      // Act
      const outcome = await callOperation(OFFER_BY_ID, inFirst);
      const rest = await suite.kit.rest('GET', '/offers');

      // Assert
      expect(outcome).toMatchObject({ code: undefined, data: { id: inFirst.offerId } });
      expect(rest.status).toBe(OK_STATUS);
    });

    it("refuses a member restricted to A's first store on the second store's offers", async () => {
      // Arrange
      const { a } = suite.fixtures;
      await suite.kit.signInAsMember(a, [OFFER_PERMISSIONS.view], [a.stores[0]]);
      suite.kit.client.setChannelToken(a.stores[1].channelToken);

      // Act
      const outcome = await callOperation(OFFER_BY_ID, inSecond);
      const rest = await suite.kit.rest('GET', '/offers');

      // Assert
      expect(outcome.code).toBe(FORBIDDEN);
      expect(rest.status).toBe(FORBIDDEN_STATUS);
    });

    it("leaves the first store's offer and its codes unchanged after those calls", async () => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const state = await stateOf(inFirst.offerId);

      // Assert
      expect(state).toEqual(untouched(inFirst.offerId, 'FIRST10'));
    });
  });
});
