import type { ArgumentsHost } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { describe, expect, it } from 'vitest';
import { RateLimitedError } from '../../api/rate-limited.error';
import { RateLimitedFilter } from '../../api/rate-limited.filter';

/** A response that records what the filter writes. */
class RecordingResponse {
  readonly headers: Record<string, string> = {};
  statusCode = 200;
  body: unknown;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    return this;
  }
}

const REQUEST = { url: '/stores/subdomain-availability', headers: {} };

const restHost = (res: RecordingResponse, request: typeof REQUEST = REQUEST): ArgumentsHost => {
  const host = new ExecutionContextHost([request, res]);
  host.setType('http');
  return host;
};

const graphqlHost = (res: RecordingResponse): ArgumentsHost => {
  const host = new ExecutionContextHost([{}, {}, { req: REQUEST, res }, {}]);
  host.setType('graphql');
  return host;
};

describe('RateLimitedFilter', () => {
  it('answers REST with 429, Retry-After and the wait in the body', () => {
    // Arrange
    const res = new RecordingResponse();

    // Act
    const returned = new RateLimitedFilter().catch(new RateLimitedError(7), restHost(res));

    // Assert
    expect(returned).toBeUndefined();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('7');
    expect(res.body).toMatchObject({ statusCode: 429, retryAfterSeconds: 7, path: REQUEST.url });
  });

  it('never echoes the query string, which may carry a secret such as an invitation token (D205)', () => {
    // Arrange
    const res = new RecordingResponse();
    const token = 'Zk3r9QbX2mVt7LpW4sYh8NcD1aFe6GuJ0oRi5TyKwMx';
    const request = { url: `/team/invitations/preview?token=${token}`, headers: {} };

    // Act
    new RateLimitedFilter().catch(new RateLimitedError(30), restHost(res, request));

    // Assert
    expect(res.body).toMatchObject({ path: '/team/invitations/preview' });
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it('sets Retry-After on GraphQL and hands the error back for the body, leaving the status alone', () => {
    // Arrange
    const res = new RecordingResponse();
    const error = new RateLimitedError(3);

    // Act
    const returned = new RateLimitedFilter().catch(error, graphqlHost(res));

    // Assert
    expect(returned).toBe(error);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Retry-After']).toBe('3');
  });
});
