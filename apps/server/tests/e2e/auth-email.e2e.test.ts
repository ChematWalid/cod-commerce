import { randomUUID } from 'node:crypto';
import { AuthEmailService } from '@cod/plugin-auth';
import { RequestContext } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, removeBullKeys } from './support/e2e-config';
import { MAILPIT_SMTP_PORT, waitForMessageTo } from './support/mailpit';
import { E2E_PORTS } from './support/ports';

const SUITE = 'auth-email';
const DELIVERY_TIMEOUT_MS = 20_000;
const LINK_TOKEN = 'e2e-link-token-0123456789';
const OTP = '482913';

describe('account email through the BullMQ worker queue', () => {
  // The test server runs every queue (`activeQueues` unset), `auth-email` among them in the critical pool (D42, D97).
  const { server } = createTestEnvironment(
    buildE2eConfig(
      {},
      {
        suite: SUITE,
        port: E2E_PORTS.authEmail,
        env: { SMTP_HOST: 'localhost', SMTP_PORT: MAILPIT_SMTP_PORT, WORKER_POOL: 'all' },
      },
    ),
  );

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('delivers the real Arabic verification email with its link and code', async () => {
    // Arrange
    const to = `owner-${randomUUID()}@example.test`;

    // Act
    await server.app.get(AuthEmailService).enqueue(RequestContext.empty() as never, {
      kind: 'verification',
      to,
      locale: 'ar',
      vars: { name: 'Sara', link: `https://dash.example.test/verify?token=${LINK_TOKEN}`, code: OTP },
    });
    const message = await waitForMessageTo(to, DELIVERY_TIMEOUT_MS);

    // Assert
    expect(message.Subject).toMatch(/\p{Script=Arabic}/u);
    expect(message.HTML).toContain('dir="rtl"');
    expect(message.HTML).toContain(`token=${LINK_TOKEN}`);
    expect(message.Text).toContain(`token=${LINK_TOKEN}`);
    expect(message.Text).toContain(OTP);
  });
});
