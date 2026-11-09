import { randomUUID } from 'node:crypto';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { ConfigService, RequestContext, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthEmailService } from '../../application/auth-email.service';
import { AUTH_EMAIL_QUEUE } from '../../domain/constants';
import type { AuthEmailRequest } from '../../domain/email';
import type { OperationContext } from '../../domain/ports/operation-context';
import { createAuthTestEnvironment } from './auth-test-environment';
import { messagesTo, waitForMessages } from './mailpit';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const RAW_TOKEN = 'integration-raw-token-0123456789abcdef';
const OTP = '482913';
const QUIET_PERIOD_MS = 1500;

const { server } = createAuthTestEnvironment(TOKEN_SECRET);

let service: AuthEmailService;
let connection: TransactionalConnection;
let queuedData: unknown[] = [];

const newAddress = (): string => `owner-${randomUUID()}@example.test`;
const request = (to: string): AuthEmailRequest => ({
  kind: 'verification',
  to,
  locale: 'ar',
  vars: { name: 'Sara', link: `https://dash.example.test/verify?token=${RAW_TOKEN}`, code: OTP },
});

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  service = server.app.get(AuthEmailService);
  connection = server.app.get(TransactionalConnection);
  const strategy = server.app.get(ConfigService).jobQueueOptions.jobQueueStrategy;
  const add = strategy.add.bind(strategy);
  vi.spyOn(strategy, 'add').mockImplementation((job, options) => {
    if (job.queueName === AUTH_EMAIL_QUEUE) {
      queuedData.push(job.data);
    }
    return add(job, options);
  });
});

afterAll(async () => {
  await server.destroy();
});

describe('account email through the worker queue', () => {
  it('delivers a queued email to Mailpit with its link and code', async () => {
    // Arrange
    const to = newAddress();

    // Act
    await service.enqueue(RequestContext.empty() as unknown as OperationContext, request(to));
    const [message] = await waitForMessages(to);

    // Assert
    expect(message?.Subject).toBe('verification/ar');
    expect(message?.Text).toContain(`token=${RAW_TOKEN}`);
    expect(message?.Text).toContain(`code=${OTP}`);
  });

  it('stores no raw token, code or address in the queued job', async () => {
    // Arrange
    queuedData = [];
    const to = newAddress();

    // Act
    await service.enqueue(RequestContext.empty() as unknown as OperationContext, request(to));
    await waitForMessages(to);

    // Assert
    expect(queuedData).toHaveLength(1);
    const stored = JSON.stringify(queuedData[0]);
    expect(Object.keys(queuedData[0] as object)).toEqual(['sealed']);
    expect(stored).not.toContain(RAW_TOKEN);
    expect(stored).not.toContain(OTP);
    expect(stored).not.toContain(to);
  });

  it('sends after the surrounding transaction commits, and not at all if it rolls back', async () => {
    // Arrange
    const committed = newAddress();
    const rolledBack = newAddress();
    const ctx = RequestContext.empty();

    // Act
    await connection.withTransaction(ctx, async (transactional) => {
      await service.enqueue(transactional as unknown as OperationContext, request(committed));
    });
    await connection
      .withTransaction(ctx, async (transactional) => {
        await service.enqueue(transactional as unknown as OperationContext, request(rolledBack));
        throw new Error('rolled back on purpose');
      })
      .catch(() => undefined);
    await waitForMessages(committed);
    await new Promise((resolve) => setTimeout(resolve, QUIET_PERIOD_MS));

    // Assert
    expect(await messagesTo(rolledBack)).toHaveLength(0);
  });
});
