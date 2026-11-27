import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import type { StoreFixture } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { communeRow, deliveryPricingSuite, type GroupResult, LIST_GROUPS, SET_COMMUNES } from './delivery-pricing-kit';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIds,
} from './endpoint-registry';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const MALFORMED_IDS = ['abc', '-1', '99999999999999999999', ''];
/** Text no answer may carry: SQL, entity names, stacks, the victim's group name or price (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /delivery_fee/, /EntityNotFound/, /Victim/, /4321/];
const NO_CODE = 'NO_CODE';
const BY_ID = OPERATION_REGISTRY.filter((entry) => entry.foreign !== 'none');
const ROUTES_BY_ID = ROUTE_REGISTRY.filter((entry) => entry.byId);
const TABLES = ['delivery_fee_group', 'delivery_fee_rate', 'delivery_fee_commune_rate'] as const;

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

function expectForeign(entry: OperationEntry, outcome: Outcome): void {
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  else expect(outcome.code).toBe(entry.notFound);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

/** A victim store's two groups (one with a commune row) as its owner made them. */
async function groupsOf(owner: typeof suite.fixtures.a, store: StoreFixture): Promise<TargetIds> {
  await suite.kit.asOwner(owner, store);
  const group = await suite.kit.createGroup('Victim', 4321);
  const spare = await suite.kit.createGroup('Victim spare', 4321);
  await suite.kit.gql(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 4321)] });
  return { groupId: group.id, spareGroupId: spare.id };
}

/** The victim groups' rows in one table: their count and a digest of every column, `updatedAt` included. */
interface TableSnapshot {
  readonly n: number;
  readonly digest: string;
}

/**
 * The victim groups' rows in every table, so a refused write is proven to change nothing: a count alone would miss
 * an in-place UPDATE or a delete-and-reinsert landing on the victim.
 */
async function rowsOf(ids: TargetIds): Promise<Record<string, TableSnapshot>> {
  const snapshot: Record<string, TableSnapshot> = {};
  for (const table of TABLES) {
    const column = table === 'delivery_fee_group' ? 'id' : 'groupId';
    const [row] = await suite.kit.query<TableSnapshot>(
      `SELECT count(*)::int AS n,
              coalesce(md5(string_agg(to_jsonb(t)::text, ',' ORDER BY to_jsonb(t)::text)), '') AS digest
         FROM "${table}" t WHERE t."${column}" IN ($1, $2)`,
      [ids.groupId, ids.spareGroupId],
    );
    snapshot[table] = row ?? { n: 0, digest: '' };
  }
  return snapshot;
}

describe.each([
  ['another business (B)', () => [suite.fixtures.b, suite.fixtures.b.stores[0]] as const],
  ['another store of the same business (A2)', () => [suite.fixtures.a, suite.fixtures.a.stores[1]] as const],
])('fee-group isolation against %s', (_label, victim) => {
  let ids: TargetIds;
  let before: Record<string, TableSnapshot>;

  beforeAll(async () => {
    const [owner, store] = victim();
    ids = await groupsOf(owner, store);
    before = await rowsOf(ids);
  });

  it.each(BY_ID)("$operation as A on store A1 against the victim's ids answers $foreign", async (entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, ids);

    // Assert
    expectForeign(entry, outcome);
    expect(await rowsOf(ids)).toEqual(before);
  });

  it.each(ROUTES_BY_ID)(
    "$method $route as A on store A1 against the victim's ids answers 404",
    async (entry: RouteEntry) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.());

      // Assert
      expect(answer).toMatchObject({ status: 404, body: { code: 'delivery-pricing.not-found' } });
      for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
      expect(await rowsOf(ids)).toEqual(before);
    },
  );

  it("never lists the victim's groups, over GraphQL or REST", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const { deliveryFeeGroups } = await suite.kit.gql<{ deliveryFeeGroups: { items: GroupResult[] } }>(LIST_GROUPS);
    const rest = await suite.kit.rest('GET', '/delivery-fees?search=Victim');

    // Assert
    const listed = [...deliveryFeeGroups.items, ...(rest.body as { items: GroupResult[] }).items].map((g) => g.id);
    expect(listed).not.toContain(ids.groupId);
    expect(listed).not.toContain(ids.spareGroupId);
  });
});

describe('fee-group ids that name no row', () => {
  it.each(BY_ID.flatMap((entry) => MALFORMED_IDS.map((id) => [entry.operation, id, entry] as const)))(
    '%s answers not found for the malformed id "%s"',
    async (_operation, id, entry) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const outcome = await callOperation(entry, { groupId: id, spareGroupId: id });

      // Assert
      expectForeign(entry, outcome);
    },
  );

  it('answers the same code and message for an unknown id as for a foreign one', async () => {
    // Arrange
    const ids = await groupsOf(suite.fixtures.b, suite.fixtures.b.stores[1]);
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const foreign = await suite.kit.rest('PUT', `/delivery-fees/${ids.groupId}/communes/16`, { rows: [] });
    const unknown = await suite.kit.rest('PUT', '/delivery-fees/1000000000000000001/communes/16', { rows: [] });

    // Assert
    expect({ ...(foreign.body as object), path: '' }).toEqual({ ...(unknown.body as object), path: '' });
  });
});

describe('the delivery-pricing census', () => {
  it('counts rows of both businesses in every fee table, the commune layer included', async () => {
    // Arrange
    await groupsOf(suite.fixtures.a, suite.fixtures.a.stores[0]);
    await groupsOf(suite.fixtures.b, suite.fixtures.b.stores[0]);

    // Act
    const counts = await Promise.all(
      TABLES.flatMap((table) =>
        [suite.fixtures.a, suite.fixtures.b].map(async (business) => {
          const [row] = await suite.kit.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM "${table}" WHERE "businessId" = $1`,
            [business.businessId],
          );
          return row?.n ?? 0;
        }),
      ),
    );

    // Assert
    expect(counts.every((count) => count > 0)).toBe(true);
  });
});
