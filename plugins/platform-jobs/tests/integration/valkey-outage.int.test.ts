import { createServer } from 'node:net';
import type { BusinessId } from '@cod/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ValkeyBusinessSemaphore } from '../../infrastructure/valkey-business-semaphore';
import { ValkeyCircuitBreaker } from '../../infrastructure/valkey-circuit-breaker';
import { connectFixture, releaseFixture, type ValkeyFixture } from '../fakes/valkey-fixture';

/** A local port nothing listens on: bound once to learn a free number, then closed. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  if (address === null || typeof address === 'string') throw new Error('no TCP address');
  return address.port;
}

let fixture: ValkeyFixture;

beforeEach(async () => {
  fixture = await connectFixture(`redis://127.0.0.1:${String(await closedPort())}`);
});

afterEach(async () => {
  await releaseFixture(fixture);
});

describe('Valkey unreachable', () => {
  it('runs the work of both the semaphore and the breaker, and logs one error', async () => {
    // Arrange
    const options = { appEnv: fixture.appEnv, clock: fixture.clock };
    const semaphore = new ValkeyBusinessSemaphore(fixture.valkey, options);
    const breaker = new ValkeyCircuitBreaker(fixture.valkey, options);
    const key = { queue: 'order-effects', businessId: 'business-a' as BusinessId } as const;

    // Act
    const fromSemaphore = await semaphore.withBusinessSemaphore(key, 1, () => Promise.resolve('semaphore ran'));
    const fromBreaker = await breaker.withCircuitBreaker({ provider: 'demo', accountId: 'a' }, () =>
      Promise.resolve('breaker ran'),
    );
    const state = await breaker.stateOf({ provider: 'demo', accountId: 'a' });

    // Assert
    expect(fromSemaphore).toBe('semaphore ran');
    expect(fromBreaker).toBe('breaker ran');
    expect(state).toBe('closed');
    expect(fixture.errors).toHaveLength(1);
    expect(fixture.errors[0]).toMatch(/Valkey unavailable/);
  });
});
