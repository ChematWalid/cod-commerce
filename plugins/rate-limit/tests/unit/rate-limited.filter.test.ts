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

const restHost = (res: RecordingResponse): ArgumentsHost => {
  const host = new ExecutionContextHost([REQUEST, res]);
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
