import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type BusinessFixture, type TwoBusinesses } from '@cod/testing';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoSignature } from '../../infrastructure/demo/demo-webhook.handler';
import { createWebhooksTestEnvironment, until, webhooksKit } from './webhooks-kit';

const SNOWFLAKE_WORKER_ID = 1000;

const SECRET_A = 'synthetic-demo-signing-secret-A';
const SECRET_B = 'synthetic-demo-signing-secret-B';

const SET_TENANT_SECRET = gql`
  mutation ($input: SetTenantSecretInput!) {
    setTenantSecret(input: $input) {
      id
    }
  }
`;

const ARCHIVE_STORE = gql`
  mutation ($id: String!) {
    archiveStore(id: $id) {
      id
      status
    }
  }
`;

describe('demo webhook chain', () => {
  const environment = createWebhooksTestEnvironment(SNOWFLAKE_WORKER_ID, {
    demo: true,
    plugins: [RbacPlugin],
    schemas: [ACTIVITY_LOG_SCHEMA],
  });
  const { server, adminClient } = environment;
  const kit = webhooksKit(server);
  let businesses: TwoBusinesses;

  const asOwner = async (business: BusinessFixture): Promise<void> => {
    adminClient.setChannelToken(business.stores[0].channelToken);
    await adminClient.asUserWithCredentials(business.owner.email, business.owner.password);
  };

  const setSecret = async (business: BusinessFixture, value: string): Promise<void> => {
    await asOwner(business);
    await adminClient.query(SET_TENANT_SECRET, { input: { provider: 'demo-webhook', ref: 'signing', value } });
  };

  /** Posts `body` to the demo provider; the signature is the secret's unless `signature` overrides it. */
  const postDemo = (
    subdomain: string,
    body: string,
    signing: { readonly secret: string; readonly eventId: string; readonly signature?: string },
  ): ReturnType<typeof kit.post> =>
    kit.post('demo', subdomain, {
      body,
      eventId: signing.eventId,
      headers: { 'x-demo-signature': signing.signature ?? demoSignature(signing.secret, Buffer.from(body)) },
    });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    await setSecret(businesses.a, SECRET_A);
    await setSecret(businesses.b, SECRET_B);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('formats the signature as sha256=<hex of the HMAC of the raw body>', () => {
    // Act
    const signature = demoSignature('s', Buffer.from('body'));

    // Assert
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(demoSignature('s', Buffer.from('body'))).toBe(signature);
    expect(demoSignature('t', Buffer.from('body'))).not.toBe(signature);
  });

  it('takes a signed webhook through the gateway, the outbox and the demo-log consumer', async () => {
    // Arrange
    const subdomain = businesses.a.stores[0].subdomain;
    const body = JSON.stringify({ chain: 'demo' });

    // Act
    const response = await postDemo(subdomain, body, { secret: SECRET_A, eventId: 'evt-chain-1' });

    // Assert
    expect(response.status).toBe(200);
    const inbound = await until(async () => {
      const rows = await kit.sql(
        `SELECT "id"::text AS "id", "status", "businessId"::text AS "businessId" FROM "inbound_webhook"
          WHERE "provider" = 'demo' AND "businessId" = $1`,
        [businesses.a.businessId],
      );
      return rows[0]?.['status'] === 'processed' ? rows[0] : undefined;
    });
    expect(inbound['businessId']).toBe(businesses.a.businessId);
    const delivery = await until(async () => {
      const rows = await kit.sql(
        `SELECT d."status", e."status" AS "eventStatus", e."businessId"::text AS "businessId"
           FROM "outbox_delivery" d JOIN "outbox_event" e ON e."id" = d."outboxId"
          WHERE e."topic" = 'platform.demo' AND d."consumer" = 'demo-log'
            AND e."payload"->>'inboundId' = $1`,
        [String(inbound['id'])],
      );
      return rows[0]?.['status'] === 'done' ? rows[0] : undefined;
    });
    expect(delivery).toMatchObject({ status: 'done', eventStatus: 'relayed', businessId: businesses.a.businessId });
  });

  it('answers 401 for a wrong signature and stores nothing', async () => {
    // Arrange
    const before = await kit.sql(`SELECT count(*)::int AS n FROM "inbound_webhook" WHERE "provider" = 'demo'`);

    const body = '{"x":1}';

    // Act: a well-formed signature of the right length, made with the wrong secret
    const response = await postDemo(businesses.a.stores[0].subdomain, body, {
      secret: SECRET_A,
      eventId: 'evt-bad',
      signature: demoSignature('wrong', Buffer.from(body)),
    });

    // Assert
    expect(response.status).toBe(401);
    const after = await kit.sql(`SELECT count(*)::int AS n FROM "inbound_webhook" WHERE "provider" = 'demo'`);
    expect(after[0]?.['n']).toBe(before[0]?.['n']);
  });

  it("does not verify business A's account with business B's secret", async () => {
    // Act
    const forged = await postDemo(businesses.a.stores[0].subdomain, '{"x":2}', {
      secret: SECRET_B,
      eventId: 'evt-cross',
    });
    const own = await postDemo(businesses.b.stores[0].subdomain, '{"x":3}', { secret: SECRET_B, eventId: 'evt-own-b' });

    // Assert
    expect(forged.status).toBe(401);
    expect(own.status).toBe(200);
  });

  it('answers 404 for an archived store, even with a valid signature', async () => {
    // Arrange
    await asOwner(businesses.a);
    const archived = businesses.a.stores[1];
    await adminClient.query(ARCHIVE_STORE, { id: archived.id });

    // Act
    const response = await postDemo(archived.subdomain, '{"x":4}', { secret: SECRET_A, eventId: 'evt-archived' });

    // Assert
    expect(response.status).toBe(404);
  });

  it('answers 404 for an unknown subdomain', async () => {
    // Act
    const response = await postDemo('no-such-store', '{"x":5}', { secret: SECRET_A, eventId: 'evt-unknown' });

    // Assert
    expect(response.status).toBe(404);
  });
});
