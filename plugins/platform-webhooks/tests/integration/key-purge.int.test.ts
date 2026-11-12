import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InboundKeyPurge } from '../../application/key-purge.service';
import { createWebhooksTestEnvironment, webhooksKit } from './webhooks-kit';

const SNOWFLAKE_WORKER_ID = 1005;
const DAY_MS = 86_400_000;
const OLD_KEYS = 5001;

describe('inbound webhook key purge', () => {
  const { server } = createWebhooksTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = webhooksKit(server);
  const now = new Date('2031-06-30T04:15:00Z');

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('deletes keys older than 30 days in batches and keeps newer ones', async () => {
    // Arrange
    await kit.sql(`DELETE FROM "inbound_webhook_key"`);
    await kit.sql(
      `INSERT INTO "inbound_webhook_key" ("provider", "accountId", "eventKey", "receivedAt")
       SELECT 'test', 'acct-a', 'old-' || n, $1::timestamptz FROM generate_series(1, $2) AS n`,
      [new Date(now.getTime() - 31 * DAY_MS), OLD_KEYS],
    );
    await kit.sql(
      `INSERT INTO "inbound_webhook_key" ("provider", "accountId", "eventKey", "receivedAt") VALUES
         ('test', 'acct-a', 'edge', $1), ('test', 'acct-a', 'fresh-1', $2), ('test', 'acct-a', 'fresh-2', $3)`,
      [new Date(now.getTime() - 30 * DAY_MS + 1000), new Date(now.getTime() - DAY_MS), now],
    );

    // Act
    const result = await server.app.get(InboundKeyPurge).purge(now);

    // Assert
    expect(result.deleted).toBe(OLD_KEYS);
    const remaining = await kit.sql(`SELECT "eventKey" FROM "inbound_webhook_key" ORDER BY "eventKey"`);
    expect(remaining.map((row) => row['eventKey'])).toEqual(['edge', 'fresh-1', 'fresh-2']);
  });
});
