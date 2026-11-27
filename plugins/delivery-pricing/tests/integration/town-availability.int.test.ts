import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import type { DeliveryFeeGroupInput, Province, Town } from '@cod/shared';
import { INTERNAL_AUTH_HEADERS } from '@cod/shared/internal-auth';
import type { BusinessFixture, StoreFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { asOperationContext, DeliveryDefaultsConvergeService } from '../../index';
import { communeRow, deliveryPricingSuite, groupInput, SET_COMMUNES, UPDATE_GROUP } from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const ALGER = '16';
const ALGER_CENTRE = 1601;
const CHERAGA = 1652;

/**
 * The towns of Alger as the signed storefront route answers them for `store` (geo caches each store's answer). The
 * signed store header is the one the internal-only middleware passes on once the signature checks (D3106, D3135).
 */
async function algerTownsFor(store: StoreFixture): Promise<readonly Town[]> {
  const { port } = (suite.kit.app.getHttpServer() as Server).address() as AddressInfo;
  const response = await fetch(`http://localhost:${String(port)}/store/provinces/code/${ALGER}?storeId=${store.id}`, {
    headers: { [INTERNAL_AUTH_HEADERS.storeId]: store.id },
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as Province).towns ?? [];
}

/** The reference towns of Alger, before any store narrows them. */
async function referenceAlgerTowns(): Promise<readonly Town[]> {
  const { port } = (suite.kit.app.getHttpServer() as Server).address() as AddressInfo;
  const response = await fetch(`http://localhost:${String(port)}/provinces/code/${ALGER}`);
  return ((await response.json()) as Province).towns ?? [];
}

/** The store's default group id, as stored. */
async function defaultGroupOf(store: StoreFixture): Promise<string> {
  const [row] = await suite.kit.query<{ id: string | null }>(
    'SELECT "defaultDeliveryFeeGroupId" AS id FROM "store" WHERE id = $1',
    [store.id],
  );
  if (row?.id == null) throw new Error(`store ${store.id} has no default fee group`);
  return row.id;
}

/** Rewrites `store`'s default group with Alger's two switches set, every other wilaya delivered with desk. */
async function setAlgerSwitches(
  business: BusinessFixture,
  store: StoreFixture,
  switches: { readonly deliveryEnabled: boolean; readonly deskEnabled: boolean },
): Promise<string> {
  await suite.kit.asOwner(business, store);
  const groupId = await defaultGroupOf(store);
  const input = groupInput();
  const rates = input.rates.map((rate) => (rate.provinceCode === ALGER ? { ...rate, ...switches } : rate));
  await suite.kit.gql(UPDATE_GROUP, { id: groupId, input: { ...input, rates } satisfies DeliveryFeeGroupInput });
  return groupId;
}

const flagsOf = (towns: readonly Town[], codeOns: number) => {
  const town = towns.find((candidate) => candidate.codeOns === codeOns);
  return { isHomeDelivery: town?.isHomeDelivery, isStopdesk: town?.isStopdesk };
};

beforeAll(async () => {
  // Every fixture store gets its default table, as `migrate` does for stores made before the hook (D3112).
  const ctx = await suite.kit.app.get(RequestContextService).create({ apiType: 'admin' });
  await suite.kit.app.get(DeliveryDefaultsConvergeService).convergeAll(asOperationContext(ctx));
});

// The plugin test server has no internal-only guard (D3130 (7)): the signed prefix's refusal of an unsigned call is
// proven on the full api config. Each case uses its own store, since geo caches a store's narrowed wilaya for 30 s.
describe("the signed provinces route narrows the communes by the store's fee table (Task 8)", () => {
  it('turns every stop desk off in a wilaya whose desk switch is off', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[0];
    await setAlgerSwitches(a, store, { deliveryEnabled: true, deskEnabled: false });

    // Act
    const towns = await algerTownsFor(store);

    // Assert
    expect(towns.length).toBeGreaterThan(0);
    expect(towns.every((town) => !town.isStopdesk)).toBe(true);
    expect(towns.filter((town) => town.isHomeDelivery)).toHaveLength(towns.length);
  });

  it('turns home delivery and stop desk off in a wilaya that is not delivered', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[1];
    await setAlgerSwitches(a, store, { deliveryEnabled: false, deskEnabled: true });

    // Act
    const towns = await algerTownsFor(store);

    // Assert
    expect(towns.every((town) => !town.isHomeDelivery && !town.isStopdesk)).toBe(true);
  });

  it('turns off only the commune switched off in a delivered wilaya', async () => {
    // Arrange
    const { b } = suite.fixtures;
    const store = b.stores[0];
    const groupId = await setAlgerSwitches(b, store, { deliveryEnabled: true, deskEnabled: true });
    await suite.kit.gql(SET_COMMUNES, {
      groupId,
      provinceCode: ALGER,
      rows: [{ ...communeRow(CHERAGA), deliveryEnabled: false }],
    });
    const reference = await referenceAlgerTowns();

    // Act
    const towns = await algerTownsFor(store);

    // Assert
    expect(flagsOf(towns, CHERAGA)).toEqual({ isHomeDelivery: false, isStopdesk: false });
    expect(flagsOf(towns, ALGER_CENTRE)).toEqual(flagsOf(reference, ALGER_CENTRE));
    expect(towns.filter((town) => town.codeOns !== CHERAGA)).toEqual(
      reference.filter((town) => town.codeOns !== CHERAGA),
    );
  });

  it("never lets one business's switches change the answer for another business's store", async () => {
    // Arrange: A's first store has turned every desk off in Alger (first case); B's second store keeps its default.
    const { a, b } = suite.fixtures;
    await setAlgerSwitches(a, a.stores[0], { deliveryEnabled: false, deskEnabled: false });
    const reference = await referenceAlgerTowns();

    // Act
    const ofB = await algerTownsFor(b.stores[1]);

    // Assert
    expect(ofB).toEqual(reference);
  });
});
