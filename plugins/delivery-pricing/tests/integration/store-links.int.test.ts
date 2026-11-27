import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { WILAYA_CODES } from '@cod/shared';
import type { StoreFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { STORE_DEFAULTS } from '../../application/tokens';
import type { StoreDefaultsPort } from '../../domain/ports/store-defaults.port';
import { asOperationContext, DeliveryDefaultsConvergeService } from '../../index';
import { deliveryPricingSuite } from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const REFERENCE_NOT_FOUND = 'tenancy.store-reference-not-found';
/** A well-formed id no fee group or carrier holds. */
const UNKNOWN_ID = '9007199254740993';

const UPDATE_STORE = `mutation ($id: String!, $input: UpdateStoreInput!) {
  updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId defaultCarrierId }
}`;
const CREATE_STORE = `mutation ($input: CreateStoreInput!) {
  createStore(input: $input) { id defaultDeliveryFeeGroupId }
}`;

interface StoreLinks {
  readonly id: string;
  readonly defaultDeliveryFeeGroupId: string | null;
  readonly defaultCarrierId?: string | null;
}

interface ClientErrorShape {
  readonly response?: { readonly errors?: readonly unknown[] };
}

/** The store's default group id and its platform default group, as stored. */
async function linksOf(storeId: string): Promise<{ defaultId: string | null; platformDefaults: string[] }> {
  const [store] = await suite.kit.query<{ id: string | null }>(
    'SELECT "defaultDeliveryFeeGroupId" AS id FROM "store" WHERE id = $1',
    [storeId],
  );
  const groups = await suite.kit.query<{ id: string }>(
    'SELECT id FROM "delivery_fee_group" WHERE "storeId" = $1 AND "isPlatformDefault"',
    [storeId],
  );
  return { defaultId: store?.id ?? null, platformDefaults: groups.map((group) => group.id) };
}

/** The errors of a refused `updateStore`, exactly as the client received them. */
async function refusalOf(store: StoreFixture, input: Record<string, unknown>): Promise<string> {
  try {
    await suite.kit.gql(UPDATE_STORE, { id: store.id, input });
  } catch (error: unknown) {
    return JSON.stringify((error as ClientErrorShape).response?.errors ?? null);
  }
  throw new Error('updateStore was accepted');
}

/** Runs the migrate converge as platform code does, outside any request's tenant. */
async function converge(): Promise<{ stores: number; linked: number }> {
  const ctx = await suite.kit.app.get(RequestContextService).create({ apiType: 'admin' });
  return suite.kit.app.get(DeliveryDefaultsConvergeService).convergeAll(asOperationContext(ctx));
}

describe('default table on store creation (D3111)', () => {
  it.each([
    ['provisioned with the business', () => suite.fixtures.a.stores[0]],
    ['opened later by the owner', () => suite.fixtures.b.stores[1]],
  ])('gives a store %s its platform default table as its default', async (_label, storeOf) => {
    // Arrange
    const store = storeOf();

    // Act
    const { defaultId, platformDefaults } = await linksOf(store.id);
    const rates = await suite.kit.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM "delivery_fee_rate" WHERE "groupId" = $1 AND "deliveryEnabled"',
      [defaultId],
    );

    // Assert
    expect(platformDefaults).toHaveLength(1);
    expect(defaultId).toBe(platformDefaults[0]);
    expect(rates[0]?.n).toBe(WILAYA_CODES.length);
  });

  it('answers createStore with the store re-read after the hooks, its default linked', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const { createStore } = await suite.kit.gql<{ createStore: StoreLinks }>(CREATE_STORE, {
      input: { name: 'A3 store', subdomain: `a3-${Date.now().toString(36)}`, language: 'ar' },
    });

    // Assert
    const { platformDefaults } = await linksOf(createStore.id);
    expect(createStore.defaultDeliveryFeeGroupId).toBe(platformDefaults[0]);
  });
});

describe('updateStore fee-group and carrier links (#230, #153)', () => {
  it("accepts a group of the updated store's own", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const own = await suite.kit.createGroup('Own');

    // Act
    const { updateStore } = await suite.kit.gql<{ updateStore: StoreLinks }>(UPDATE_STORE, {
      id: suite.fixtures.a.stores[0].id,
      input: { defaultDeliveryFeeGroupId: own.id },
    });

    // Assert
    expect(updateStore.defaultDeliveryFeeGroupId).toBe(own.id);
  });

  it("answers B's group, another store's group, an unknown id and any carrier id byte for byte the same", async () => {
    // Arrange
    const [a1, a2] = suite.fixtures.a.stores;
    await suite.kit.asOwner(suite.fixtures.b);
    const bGroup = await suite.kit.createGroup('B group');
    await suite.kit.asOwner(suite.fixtures.a, a2);
    const a2Group = await suite.kit.createGroup('A2 group');
    await suite.kit.asOwner(suite.fixtures.a, a1);
    const a1Group = await suite.kit.createGroup('A1 group');
    const before = [await linksOf(a1.id), await linksOf(a2.id)];

    // Act
    const answers = [
      await refusalOf(a1, { defaultDeliveryFeeGroupId: bGroup.id }),
      await refusalOf(a1, { defaultDeliveryFeeGroupId: a2Group.id }),
      // Active on A1, updating A2: the check is scoped to the updated store, not the session's.
      await refusalOf(a2, { defaultDeliveryFeeGroupId: a1Group.id }),
      await refusalOf(a1, { defaultDeliveryFeeGroupId: UNKNOWN_ID }),
      await refusalOf(a1, { defaultCarrierId: UNKNOWN_ID }),
      await refusalOf(a1, { defaultCarrierId: a1Group.id }),
    ];

    // Assert
    expect(answers[0]).toContain(REFERENCE_NOT_FOUND);
    expect(new Set(answers).size).toBe(1);
    expect([await linksOf(a1.id), await linksOf(a2.id)]).toEqual(before);
  });
});

describe('default table converge on migrate (D3112)', () => {
  it('is idempotent: one platform default per store, each store linked to it', async () => {
    // Arrange
    const stores = [...suite.fixtures.a.stores, ...suite.fixtures.b.stores];
    await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = NULL WHERE id = $1', [stores[1]?.id]);

    // Act
    const first = await converge();
    const second = await converge();

    // Assert
    expect(first.linked).toBeGreaterThanOrEqual(1);
    expect(second.linked).toBe(0);
    for (const store of stores) {
      const { defaultId, platformDefaults } = await linksOf(store.id);
      expect(platformDefaults).toHaveLength(1);
      expect(defaultId).not.toBeNull();
    }
    const relinked = await linksOf(stores[1]?.id ?? '');
    expect(relinked.defaultId).toBe(relinked.platformDefaults[0]);
  });

  it("keeps the group a merchant linked between the converge's page read and the store's transaction", async () => {
    // Arrange
    const a1 = suite.fixtures.a.stores[0];
    await suite.kit.asOwner(suite.fixtures.a, a1);
    const own = await suite.kit.createGroup('Linked during the converge');
    await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = NULL WHERE id = $1', [a1.id]);
    const storeDefaults = suite.kit.app.get<StoreDefaultsPort>(STORE_DEFAULTS);
    const readPage = storeDefaults.activeStores.bind(storeDefaults);
    const spy = vi.spyOn(storeDefaults, 'activeStores').mockImplementation(async (ctx, after, limit) => {
      const page = await readPage(ctx, after, limit);
      await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = $1 WHERE id = $2', [own.id, a1.id]);
      return page;
    });

    // Act
    try {
      await converge();
    } finally {
      spy.mockRestore();
    }

    // Assert
    expect((await linksOf(a1.id)).defaultId).toBe(own.id);
  });

  it("repairs a dangling id, such as B's group stored on A before #230", async () => {
    // Arrange
    const a1 = suite.fixtures.a.stores[0];
    await suite.kit.asOwner(suite.fixtures.b);
    const bGroup = await suite.kit.createGroup('B group stored before the fix');
    await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = $1 WHERE id = $2', [bGroup.id, a1.id]);

    // Act
    await converge();

    // Assert
    const { defaultId, platformDefaults } = await linksOf(a1.id);
    expect(defaultId).toBe(platformDefaults[0]);
  });
});
