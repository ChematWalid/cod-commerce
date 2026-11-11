import { PLATFORM_CLOCK, TASK_HEARTBEAT_WRITER, type TaskHeartbeatWriter } from '@cod/plugin-platform-jobs';
import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, failureOf, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ManualClock } from '../fixtures/manual-clock';
import { createOutboxTestEnvironment, outboxKit } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1018;
const SECOND_MS = 1000;
const OLDEST_AGE_SECONDS = 600;
const HEARTBEAT_AGE_SECONDS = 90;
const PENDING_ROWS = 3;

const JOBS_HEALTH = gql`
  query {
    platformJobsHealth {
      outboxPending
      outboxOldestPendingAgeSeconds
      tasks {
        id
        lastSuccessAgeSeconds
      }
    }
  }
`;

interface Health {
  platformJobsHealth: {
    outboxPending: number;
    outboxOldestPendingAgeSeconds: number | null;
    tasks: { id: string; lastSuccessAgeSeconds: number | null }[];
  };
}

describe('platform jobs health', () => {
  const clock = new ManualClock();
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID, clock);
  const kit = outboxKit(server);
  let businesses: TwoBusinesses;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    const now = clock.now();
    await kit.sql(`DELETE FROM "outbox_event"`);
    for (let index = 0; index < PENDING_ROWS; index += 1) {
      const createdAt = new Date(now - (OLDEST_AGE_SECONDS - index) * SECOND_MS);
      await kit.sql(
        `INSERT INTO "outbox_event" ("businessId", "id", "createdAt", "topic", "payload", "status")
         VALUES ($1, $2, $3, 'order.delivered', '{}', 'pending')`,
        [businesses.a.businessId, `74000000000000000${String(index)}`, createdAt],
      );
    }
    await kit.sql(
      `INSERT INTO "outbox_event" ("businessId", "id", "createdAt", "topic", "payload", "status", "relayedAt")
       VALUES ($1, '7400000000000000099', $2, 'order.delivered', '{}', 'relayed', $2)`,
      [businesses.a.businessId, new Date(now)],
    );
    await server.app
      .get<TaskHeartbeatWriter>(TASK_HEARTBEAT_WRITER)
      .recordSuccess('outbox-sweeper', new Date(now - HEARTBEAT_AGE_SECONDS * SECOND_MS));
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('gives platform staff the pending count, the oldest age and each task heartbeat', async () => {
    // Arrange
    expect(server.app.get(PLATFORM_CLOCK)).toBe(clock);
    await adminClient.asSuperAdmin();

    // Act
    const { platformJobsHealth } = await adminClient.query<Health>(JOBS_HEALTH);

    // Assert
    expect(platformJobsHealth.outboxPending).toBe(PENDING_ROWS);
    expect(platformJobsHealth.outboxOldestPendingAgeSeconds).toBe(OLDEST_AGE_SECONDS);
    const tasks = new Map(platformJobsHealth.tasks.map((task) => [task.id, task.lastSuccessAgeSeconds]));
    expect(tasks.get('outbox-sweeper')).toBe(HEARTBEAT_AGE_SECONDS);
    expect(tasks.has('partition-maintenance')).toBe(true);
    expect(tasks.get('partition-maintenance')).toBeNull();
  });

  it('refuses a merchant owner', async () => {
    // Arrange
    adminClient.setChannelToken(businesses.a.stores[0].channelToken);
    await adminClient.asUserWithCredentials(businesses.a.owner.email, businesses.a.owner.password);

    // Act
    const failure = await failureOf(adminClient.query(JOBS_HEALTH));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });
});
