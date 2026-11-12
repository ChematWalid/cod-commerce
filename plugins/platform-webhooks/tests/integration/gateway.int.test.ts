import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebhookGatewayService } from '../../application/webhook-gateway.service';
import { KILL_SWITCH } from '../../application/tokens';
import { INBOUND_WEBHOOKS_FLAG, WEBHOOK_BODY_LIMIT_BYTES } from '../../domain/constants';
import type { ConfigurableKillSwitch } from '../../infrastructure/configurable-kill-switch';
import { processing, signTestBody, TEST_EVENT_HEADER } from '../fixtures/test-handler.plugin';
import { createWebhooksTestEnvironment, initWithAccounts, until, webhooksKit } from './webhooks-kit';

const SNOWFLAKE_WORKER_ID = 1001;
const DAY_MS = 86_400_000;

describe('inbound webhook gateway', () => {
  const environment = createWebhooksTestEnvironment(SNOWFLAKE_WORKER_ID);
  const { server, adminClient } = environment;
  const kit = webhooksKit(server);
  let businesses: TwoBusinesses;

  const count = async (table: string): Promise<number> =>
    Number((await kit.sql(`SELECT count(*)::int AS n FROM "${table}"`))[0]?.['n']);

  beforeAll(async () => {
    businesses = await initWithAccounts(environment, () => createTwoBusinesses(adminClient));
  }, 120_000);

  beforeEach(async () => {
    processing.reset();
    await kit.sql(`DELETE FROM "inbound_webhook_key"`);
    await kit.sql(`DELETE FROM "inbound_webhook"`);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('accepts a signed webhook: 200, one key row, one received row, one job', async () => {
    // Act
    const response = await kit.post('test', 'acme-a', { body: '{"hello":"world"}', eventId: 'evt-1' });

    // Assert
    expect(response.status).toBe(200);
    expect(JSON.parse(response.text)).toEqual({ status: 'accepted' });
    expect(await count('inbound_webhook_key')).toBe(1);
    const rows = await kit.sql(
      `SELECT "id"::text AS "id", "businessId"::text AS "businessId", "provider", "accountId", "eventKey", "status", "contentType"
         FROM "inbound_webhook"`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      businessId: businesses.a.businessId,
      provider: 'test',
      accountId: 'acct-a',
      eventKey: 'evt-1',
      contentType: 'application/json',
    });
    const jobs = await kit.jobsOf('inbound-webhooks');
    expect(jobs.map((job) => job.data['jobId'])).toEqual([`iw-${String(rows[0]?.['id'])}`]);
  });

  it('keeps one key row, one row and one processing run for the same body posted five times at once and again a day later', async () => {
    // Arrange
    const body = '{"same":"body"}';

    // Act
    const burst = await Promise.all(Array.from({ length: 5 }, () => kit.post('test', 'acme-a', { body })));
    const later = await server.app.get(WebhookGatewayService).receive(
      'test',
      'acme-a',
      {
        headers: { 'x-test-signature': signTestBody(body) },
        rawBody: Buffer.from(body),
        contentType: 'application/json',
      },
      new Date(Date.now() + DAY_MS),
    );

    // Assert
    expect(burst.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(later).toBe('duplicate');
    expect(await count('inbound_webhook_key')).toBe(1);
    expect(await count('inbound_webhook')).toBe(1);
    await until(async () => {
      const rows = await kit.sql(`SELECT "status" FROM "inbound_webhook"`);
      return rows[0]?.['status'] === 'processed' ? true : undefined;
    });
    expect(processing.total()).toBe(1);
  });

  it('answers 401 for a bad signature and stores nothing', async () => {
    // Arrange
    const jobsBefore = (await kit.jobsOf('inbound-webhooks')).length;

    // Act
    const response = await kit.post('test', 'acme-a', { signature: 'sha256=00' });

    // Assert
    expect(response.status).toBe(401);
    expect(await count('inbound_webhook_key')).toBe(0);
    expect(await count('inbound_webhook')).toBe(0);
    expect(await kit.jobsOf('inbound-webhooks')).toHaveLength(jobsBefore);
  });

  it('answers 404 for an unknown account and for an unknown provider', async () => {
    // Act
    const unknownAccount = await kit.post('test', 'nobody');
    const unknownProvider = await kit.post('nope', 'acme-a');

    // Assert
    expect(unknownAccount.status).toBe(404);
    expect(unknownProvider.status).toBe(404);
    expect(await count('inbound_webhook_key')).toBe(0);
  });

  describe('with the kill switch off', () => {
    afterAll(() => {
      server.app.get<ConfigurableKillSwitch>(KILL_SWITCH).setEnabled(INBOUND_WEBHOOKS_FLAG, true);
    });

    it('answers 503 with Retry-After: 60 and stores nothing', async () => {
      // Arrange
      server.app.get<ConfigurableKillSwitch>(KILL_SWITCH).setEnabled(INBOUND_WEBHOOKS_FLAG, false);

      // Act
      const response = await kit.post('test', 'acme-a');

      // Assert
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('60');
      expect(await count('inbound_webhook_key')).toBe(0);
    });
  });

  describe('body cap (Review Focus 3)', () => {
    it('accepts exactly 262 144 bytes and refuses one byte more with 413 and no key row', async () => {
      // Arrange
      const atCap = Buffer.alloc(WEBHOOK_BODY_LIMIT_BYTES, 'a');
      const overCap = Buffer.alloc(WEBHOOK_BODY_LIMIT_BYTES + 1, 'a');

      // Act
      const accepted = await kit.post('test', 'acme-a', { body: atCap, contentType: 'application/octet-stream' });
      const keysBefore = await count('inbound_webhook_key');
      const refused = await kit.post('test', 'acme-a', { body: overCap, contentType: 'application/octet-stream' });

      // Assert
      expect(accepted.status).toBe(200);
      expect(keysBefore).toBe(1);
      expect(refused.status).toBe(413);
      expect(await count('inbound_webhook_key')).toBe(1);
      expect(await count('inbound_webhook')).toBe(1);
    });

    it('answers 413 for a gzip body that inflates past the cap', async () => {
      // Arrange
      const inflated = Buffer.alloc(WEBHOOK_BODY_LIMIT_BYTES * 4, 'a');
      const compressed = gzipSync(inflated);
      expect(compressed.length).toBeLessThan(WEBHOOK_BODY_LIMIT_BYTES);

      // Act
      const response = await kit.post('test', 'acme-a', {
        body: compressed,
        contentType: 'application/octet-stream',
        headers: { 'content-encoding': 'gzip' },
      });

      // Assert
      expect(response.status).toBe(413);
      expect(await count('inbound_webhook_key')).toBe(0);
    });

    it('keys a form-encoded body on its raw bytes', async () => {
      // Arrange
      const body = 'b=2&a=%C3%A9&a=1';

      // Act
      const response = await kit.post('test', 'acme-a', {
        body,
        contentType: 'application/x-www-form-urlencoded',
      });

      // Assert
      expect(response.status).toBe(200);
      const rows = await kit.sql(`SELECT "eventKey" FROM "inbound_webhook_key"`);
      const expected = createHash('sha256')
        .update(Buffer.concat([Buffer.from('test\nacct-a\n'), Buffer.from(body)]))
        .digest('hex');
      expect(rows[0]?.['eventKey']).toBe(expected);
    });
  });

  it('stores only the headers the handler asks to persist', async () => {
    // Act
    await kit.post('test', 'acme-a', {
      eventId: 'evt-headers',
      headers: { 'x-extra': 'should-not-be-kept', authorization: 'Bearer nope' },
    });

    // Assert
    const rows = await kit.sql(`SELECT "headers" FROM "inbound_webhook"`);
    expect(rows[0]?.['headers']).toEqual({ [TEST_EVENT_HEADER]: 'evt-headers' });
  });
});
