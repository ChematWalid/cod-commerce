import { randomUUID } from 'node:crypto';
import { AUTH_EMAIL_ATTEMPTS } from '../../domain/constants';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { ConfigService, Logger, RequestContext } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthEmailService } from '../../application/auth-email.service';
import type { OperationContext } from '../../domain/ports/operation-context';
import { createAuthTestEnvironment } from './auth-test-environment';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
/** Nothing listens here, so every connection is refused. */
const DEAD_SMTP = { host: '127.0.0.1', port: 1, from: 'no-reply@localhost' };
const WAIT_MS = 60_000;
const POLL_MS = 200;

const { server } = createAuthTestEnvironment(TOKEN_SECRET, { smtp: DEAD_SMTP });
const failureLogs: string[] = [];
let addedRetries: number[] = [];

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  const strategy = server.app.get(ConfigService).jobQueueOptions.jobQueueStrategy;
  const add = strategy.add.bind(strategy);
  vi.spyOn(strategy, 'add').mockImplementation((job, options) => {
    if (job.queueName === 'auth-email') {
      addedRetries.push(job.retries);
    }
    return add(job, options);
  });
  const error = Logger.error.bind(Logger);
  vi.spyOn(Logger, 'error').mockImplementation((message, context, trace) => {
    failureLogs.push(message);
    error(message, context, trace);
  });
});

afterAll(async () => {
  await server.destroy();
});

describe('account email delivery failures', () => {
  it('retries up to five attempts and logs the kind and a recipient hash, never the address or the body', async () => {
    // Arrange
    addedRetries = [];
    const to = `owner-${randomUUID()}@example.test`;
    const secretLink = 'https://dash.example.test/verify?token=secret-link-token';

    // Act
    await server.app.get(AuthEmailService).enqueue(RequestContext.empty() as unknown as OperationContext, {
      kind: 'verification',
      to,
      locale: 'en',
      vars: { name: 'Sara', link: secretLink, code: '482913' },
    });
    const deadline = Date.now() + WAIT_MS;
    while (failureLogs.filter((line) => line.startsWith('Auth email not sent')).length < AUTH_EMAIL_ATTEMPTS) {
      if (Date.now() > deadline) {
        throw new Error('the job did not reach its fifth attempt in time');
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    // Assert
    expect(addedRetries).toEqual([AUTH_EMAIL_ATTEMPTS - 1]);
    const lines = failureLogs.filter((line) => line.startsWith('Auth email not sent'));
    expect(lines[0]).toMatch(/kind=verification recipient=[0-9a-f]{16} reason=(ECONNECTION|ESOCKET|ECONNREFUSED)/);
    expect(failureLogs.join('\n')).not.toContain(to);
    expect(failureLogs.join('\n')).not.toContain('secret-link-token');
    expect(failureLogs.join('\n')).not.toContain('482913');
  }, 90_000);
});
