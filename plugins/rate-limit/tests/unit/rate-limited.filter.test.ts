import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RateLimitedError } from '../../api/rate-limited.error';
import { RateLimitedFilter } from '../../api/rate-limited.filter';

/** What the filter wrote to the response. */
interface Answer {
  status?: number;
  body?: Record<string, unknown>;
  readonly headers: Record<string, string>;
}

/** A REST host for a request to `url`, recording the answer the filter writes. */
function restHost(url: string): { host: ArgumentsHost; answer: Answer } {
  const answer: Answer = { headers: {} };
  const res = {
    setHeader: (name: string, value: string) => {
      answer.headers[name] = value;
    },
    status(code: number) {
      answer.status = code;
      return res;
    },
    json(body: Record<string, unknown>) {
      answer.body = body;
      return res;
    },
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ url }), getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, answer };
}

describe('RateLimitedFilter', () => {
  it('answers a REST request with 429, Retry-After and the wait', () => {
    // Arrange
    const { host, answer } = restHost('/auth/login');

    // Act
    new RateLimitedFilter().catch(new RateLimitedError(7), host);

    // Assert
    expect(answer).toMatchObject({
      status: 429,
      headers: { 'Retry-After': '7' },
      body: { statusCode: 429, retryAfterSeconds: 7, path: '/auth/login' },
    });
  });

  it('never echoes the query string, which may carry a secret such as an invitation token (D205)', () => {
    // Arrange
    const token = 'Zk3r9QbX2mVt7LpW4sYh8NcD1aFe6GuJ0oRi5TyKwMx';
    const { host, answer } = restHost(`/team/invitations/preview?token=${token}`);

    // Act
    new RateLimitedFilter().catch(new RateLimitedError(30), host);

    // Assert
    expect(answer.body).toMatchObject({ path: '/team/invitations/preview' });
    expect(JSON.stringify(answer.body)).not.toContain(token);
  });
});
