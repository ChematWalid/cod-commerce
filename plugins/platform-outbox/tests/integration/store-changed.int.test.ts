import {
  TENANT_LIFECYCLE_REGISTRAR,
  type TenantLifecycleHook,
  type TenantLifecycleRegistrar,
} from '@cod/plugin-tenancy';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOutboxTestEnvironment, outboxKit } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 987;

const UPDATE_STORE = gql`
  mutation ($id: String!, $input: UpdateStoreInput!) {
    updateStore(id: $id, input: $input) {
      id
      language
    }
  }
`;

/** A hook registered after the outbox's: it fails the store change once, when armed, after the event was written. */
class FailingAfterOutbox implements TenantLifecycleHook {
  armed = false;

  businessProvisioned(): Promise<void> {
    return Promise.resolve();
  }

  storeCreated(): Promise<void> {
    return Promise.resolve();
  }

  storeChanged(): Promise<void> {
    if (!this.armed) return Promise.resolve();
    this.armed = false;
    return Promise.reject(new Error('a later hook failed'));
  }
}

describe('store.changed from a store settings change', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  const failing = new FailingAfterOutbox();
  let businesses: TwoBusinesses;

  const eventsOf = (storeId: string): Promise<Record<string, unknown>[]> =>
    kit.sql(
      `SELECT "businessId", "storeId", "aggregateId", payload FROM outbox_event WHERE topic = 'store.changed' AND "storeId" = $1`,
      [storeId],
    );

  async function updateAsOwnerOfA(language: string): Promise<void> {
    const { owner, stores } = businesses.a;
    await adminClient.asUserWithCredentials(owner.email, owner.password);
    adminClient.setChannelToken(stores[0].channelToken);
    await adminClient.query(UPDATE_STORE, { id: stores[0].id, input: { language } });
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    server.app.get<TenantLifecycleRegistrar>(TENANT_LIFECYCLE_REGISTRAR).register(failing);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('writes one store.changed row for the store and its business when the language changes', async () => {
    // Arrange
    const store = businesses.a.stores[0];

    // Act
    await updateAsOwnerOfA('fr');

    // Assert
    const events = await eventsOf(store.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      businessId: businesses.a.businessId,
      storeId: store.id,
      aggregateId: store.id,
      payload: { storeId: store.id, businessId: businesses.a.businessId, change: 'settings' },
    });
    expect(await eventsOf(businesses.b.stores[0].id)).toHaveLength(0);
  });

  it('writes no row, and keeps the old language, when the change rolls back', async () => {
    // Arrange
    const store = businesses.a.stores[0];
    const before = await eventsOf(store.id);
    failing.armed = true;

    // Act
    const update = updateAsOwnerOfA('en');

    // Assert
    await expect(update).rejects.toThrow();
    expect(await eventsOf(store.id)).toHaveLength(before.length);
    const rows = await kit.sql(`SELECT language FROM store WHERE id = $1`, [store.id]);
    expect(rows[0]?.['language']).toBe('fr');
  });
});
