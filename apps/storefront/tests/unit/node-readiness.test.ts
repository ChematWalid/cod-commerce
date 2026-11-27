import { describe, expect, it, vi } from 'vitest';
import {
  API_NOT_READY_REASON,
  API_UNREACHABLE_REASON,
  checkNodeReadiness,
  NODE_READINESS_API_TIMEOUT_MS,
} from '../../src/health/node-readiness';

const API_URL = 'http://api.internal:3000';

/** A fetch that answers `status` after `delayMs`, honouring the abort signal like the real one. */
function fakeFetch(status: number, delayMs = 0, body = '{"status":"ready"}'): typeof fetch {
  return vi.fn(
    (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(body, { status }));
        }, delayMs);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted', 'TimeoutError'));
        });
      }),
  );
}

describe('checkNodeReadiness (the node-level /api/readyz, ADR 0006 §12)', () => {
  it('is 200 when the node-local api answers /readyz 200', async () => {
    // Arrange
    const fetchApi = fakeFetch(200);
    // Act
    const answer = await checkNodeReadiness(() => API_URL, fetchApi);
    // Assert
    expect(answer.statusCode).toBe(200);
    expect(answer.body.status).toBe('ready');
    expect(answer.body.checks.storefront.ok).toBe(true);
    expect(answer.body.checks.api.ok).toBe(true);
    expect(fetchApi).toHaveBeenCalledWith(`${API_URL}/readyz`, expect.objectContaining({ cache: 'no-store' }));
  });

  it('is 503 when the api answers 503 (draining or a dependency down)', async () => {
    // Act
    const answer = await checkNodeReadiness(() => API_URL, fakeFetch(503, 0, '{"checks":{"postgres":"x"}}'));
    // Assert
    expect(answer.statusCode).toBe(503);
    expect(answer.body.checks.api).toMatchObject({ ok: false, reason: API_NOT_READY_REASON });
  });

  it('is 503 when the api takes longer than 300 ms', async () => {
    // Act
    const answer = await checkNodeReadiness(() => API_URL, fakeFetch(200, NODE_READINESS_API_TIMEOUT_MS + 200));
    // Assert
    expect(NODE_READINESS_API_TIMEOUT_MS).toBe(300);
    expect(answer.statusCode).toBe(503);
    expect(answer.body.checks.api).toMatchObject({ ok: false, reason: API_UNREACHABLE_REASON });
  });

  it('is 503 without the error text when the api cannot be reached', async () => {
    // Arrange
    const refused = vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.7:3000')));
    // Act
    const answer = await checkNodeReadiness(() => API_URL, refused);
    // Assert
    expect(answer.statusCode).toBe(503);
    expect(JSON.stringify(answer.body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.7|3000/);
  });

  it('is 503 without the error text when INTERNAL_API_URL is unusable', async () => {
    // Arrange
    const missing = (): string => {
      throw new Error('INTERNAL_API_URL is required');
    };
    // Act
    const answer = await checkNodeReadiness(missing, fakeFetch(200));
    // Assert
    expect(answer.statusCode).toBe(503);
    expect(JSON.stringify(answer.body)).not.toContain('INTERNAL_API_URL');
  });
});
