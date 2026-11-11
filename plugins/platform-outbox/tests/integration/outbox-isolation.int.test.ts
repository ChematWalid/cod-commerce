import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seenThroughScope } from '../fixtures/counting-consumer.plugin';
import { OutboxEventEntity } from '../../infrastructure/outbox-event.entity';
import { createOutboxTestEnvironment, outboxKit, until } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1022;

describe('outbox tenant isolation', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  let businesses: TwoBusinesses;
  let aEvent = '';
  let bEvent = '';

  const handled = (outboxId: string): Promise<string[]> =>
    until(() => Promise.resolve(seenThroughScope.get(`${outboxId}:counting`)));

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    aEvent = (await kit.commitEvent(businesses.a.businessId, { topic: 'platform.demo', payload: { who: 'a' } })).id;
    bEvent = (await kit.commitEvent(businesses.b.businessId, { topic: 'platform.demo', payload: { who: 'b' } })).id;
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('gives a consumer a scope that sees its own business events only', async () => {
    // Act
    const seenByA = await handled(aEvent);
    const seenByB = await handled(bEvent);

    // Assert
    expect(seenByA).toEqual([aEvent]);
    expect(seenByB).toEqual([bEvent]);
  });

  it("finds nothing when business B reads A's event through the tenant repository", async () => {
    // Arrange
    const ctx = await kit.newContext();
    const events = server.app.get(TenantRepositoryFactory).for(OutboxEventEntity);

    // Act
    const crossRead = await events.findOne(kit.scopeOf(ctx, businesses.b.businessId), { id: aEvent });
    const ownRead = await events.findOne(kit.scopeOf(ctx, businesses.b.businessId), { id: bEvent });

    // Assert
    expect(crossRead).toBeNull();
    expect(ownRead?.id).toBe(bEvent);
  });
});
