import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, failureOf, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTIVITY_LOG_QUERY, type Filters, type Page, PUBLISH } from './activity-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1011;

describe('ActivityRecordEvent', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;

  const list = async (filters: Filters): Promise<Page['activityLog']> =>
    (await adminClient.query<Page>(ACTIVITY_LOG_QUERY, { input: filters })).activityLog;

  const entityIds = async (filters: Filters): Promise<string[]> =>
    (await list(filters)).items.map((item) => item.entityId);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  const publish = (entityType: string, entityId: string, failAfter: boolean): Promise<unknown> =>
    adminClient.query(PUBLISH, { entityType, entityId, failAfter });

  it('records one row when the publisher commits', async () => {
    // Arrange
    await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);

    // Act
    await publish('event-commit', 'c1', false);
    const page = await list({ entityType: 'event-commit' });

    // Assert
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      action: 'test.event',
      entityId: 'c1',
      ip: '203.0.113.7',
      diff: { passwordHash: '[REDACTED]', name: 'kept' },
    });
  });

  it('records nothing when the publisher rolls back', async () => {
    // Arrange
    await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);

    // Act
    const failure = await failureOf(publish('event-rollback', 'r1', true));
    const rows = await entityIds({ entityType: 'event-rollback' });

    // Assert
    expect(failure.codes).toHaveLength(1);
    expect(rows).toEqual([]);
  });

  it('rejects the publisher when the handler fails, and records nothing', async () => {
    // Arrange
    await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
    const tooLong = 't'.repeat(33);

    // Act
    const failure = await failureOf(publish(tooLong, 'h1', false));
    const rows = await entityIds({ entityId: 'h1' });

    // Assert
    expect(failure.codes).toEqual(['rbac.activity-entry-invalid']);
    expect(rows).toEqual([]);
  });
});
