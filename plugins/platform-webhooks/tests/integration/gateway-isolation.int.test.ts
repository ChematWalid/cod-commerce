import { createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processing } from '../fixtures/test-handler.plugin';
import { createWebhooksTestEnvironment, initWithAccounts, until, webhooksKit } from './webhooks-kit';

const SNOWFLAKE_WORKER_ID = 1003;

describe('inbound webhook gateway, two businesses', () => {
  const environment = createWebhooksTestEnvironment(SNOWFLAKE_WORKER_ID);
  const { server, adminClient } = environment;
  const kit = webhooksKit(server);
  let businesses: TwoBusinesses;

  const countFor = async (table: string, businessId: string): Promise<number> =>
    Number(
      (await kit.sql(`SELECT count(*)::int AS n FROM "${table}" WHERE "businessId" = $1`, [businessId]))[0]?.['n'],
    );

  const waitProcessed = (businessId: string): Promise<true> =>
    until(async () => {
      const rows = await kit.sql(
        `SELECT count(*)::int AS n FROM "inbound_webhook" WHERE "businessId" = $1 AND "status" = 'processed'`,
        [businessId],
      );
      return Number(rows[0]?.['n']) === 1 ? true : undefined;
    });

  beforeAll(async () => {
    businesses = await initWithAccounts(environment, () => createTwoBusinesses(adminClient));
    processing.reset();
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it("lands a webhook for A's account key in A and leaves B's counts at zero", async () => {
    // Act
    const response = await kit.post('test', 'acme-a', { body: '{"for":"a"}' });
    await waitProcessed(businesses.a.businessId);

    // Assert
    expect(response.status).toBe(200);
    expect(await countFor('inbound_webhook', businesses.a.businessId)).toBe(1);
    expect(await countFor('outbox_event', businesses.a.businessId)).toBe(1);
    expect(await countFor('inbound_webhook', businesses.b.businessId)).toBe(0);
    expect(await countFor('outbox_event', businesses.b.businessId)).toBe(0);
  });

  it("lands a webhook for B's account key in B (positive control)", async () => {
    // Act
    const response = await kit.post('test', 'acme-b', { body: '{"for":"b"}' });
    await waitProcessed(businesses.b.businessId);

    // Assert
    expect(response.status).toBe(200);
    expect(await countFor('inbound_webhook', businesses.b.businessId)).toBe(1);
    expect(await countFor('outbox_event', businesses.b.businessId)).toBe(1);
    expect(await countFor('inbound_webhook', businesses.a.businessId)).toBe(1);
  });
});
