import type { BusinessId } from '@cod/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEMAPHORE_LEASE_MS, SEMAPHORE_RETRY_MAX_MS, SEMAPHORE_RETRY_MIN_MS } from '../../domain/constants';
import { SemaphoreBusyError } from '../../domain/errors';
import { ValkeyBusinessSemaphore } from '../../infrastructure/valkey-business-semaphore';
import { connectFixture, heldWork, releaseFixture, type ValkeyFixture } from '../fakes/valkey-fixture';

const BUSINESS_A = { queue: 'order-effects', businessId: 'business-a' as BusinessId } as const;
const BUSINESS_B = { queue: 'order-effects', businessId: 'business-b' as BusinessId } as const;
const LIMIT = 2;

let fixture: ValkeyFixture;
let semaphore: ValkeyBusinessSemaphore;

beforeEach(async () => {
  fixture = await connectFixture();
  semaphore = new ValkeyBusinessSemaphore(fixture.valkey, { appEnv: fixture.appEnv, clock: fixture.clock });
});

afterEach(async () => {
  await releaseFixture(fixture);
});

async function busyError(run: Promise<unknown>): Promise<SemaphoreBusyError> {
  const error: unknown = await run.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(SemaphoreBusyError);
  return error as SemaphoreBusyError;
}

describe('ValkeyBusinessSemaphore', () => {
  it('limits one business to `limit` concurrent jobs while another business proceeds', async () => {
    // Arrange: two holders for A
    const first = heldWork<string>();
    const second = heldWork<string>();
    const firstRun = semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, first.work);
    const secondRun = semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, second.work);
    await Promise.all([first.started, second.started]);
    const third = heldWork<string>();

    // Act
    const busy = await busyError(semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, third.work));
    const forB = await semaphore.withBusinessSemaphore(BUSINESS_B, LIMIT, () => Promise.resolve('b ran'));

    // Assert
    expect(busy.code).toBe('jobs.semaphore-busy');
    expect(busy.retryAfterMs).toBeGreaterThanOrEqual(SEMAPHORE_RETRY_MIN_MS);
    expect(busy.retryAfterMs).toBeLessThanOrEqual(SEMAPHORE_RETRY_MAX_MS);
    expect(third.calls()).toBe(0);
    expect(forB).toBe('b ran');
    first.finish('first');
    second.finish('second');
    await expect(Promise.all([firstRun, secondRun])).resolves.toEqual(['first', 'second']);
  });

  it("runs A's next job once one of its holders has finished", async () => {
    // Arrange
    const first = heldWork<string>();
    const second = heldWork<string>();
    const firstRun = semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, first.work);
    const secondRun = semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, second.work);
    await Promise.all([first.started, second.started]);
    await busyError(semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, () => Promise.resolve('too early')));

    // Act
    first.finish('first');
    await firstRun;
    const next = await semaphore.withBusinessSemaphore(BUSINESS_A, LIMIT, () => Promise.resolve('next'));

    // Assert
    expect(next).toBe('next');
    second.finish('second');
    await secondRun;
  });

  it('releases the lease of a holder whose work threw, and rethrows its error', async () => {
    // Arrange
    const failure = new Error('carrier refused');

    // Act
    const thrown = semaphore.withBusinessSemaphore(BUSINESS_A, 1, () => Promise.reject(failure));

    // Assert
    await expect(thrown).rejects.toBe(failure);
    await expect(semaphore.withBusinessSemaphore(BUSINESS_A, 1, () => Promise.resolve('after'))).resolves.toBe('after');
  });

  it("stops counting a crashed holder's lease once 600 s have passed", async () => {
    // Arrange: a holder that never finishes, as if its process died
    const crashed = heldWork<string>();
    const crashedRun = semaphore.withBusinessSemaphore(BUSINESS_A, 1, crashed.work);
    await crashed.started;

    // Act
    fixture.clock.advanceMs(SEMAPHORE_LEASE_MS - 1);
    const stillBusy = await busyError(semaphore.withBusinessSemaphore(BUSINESS_A, 1, () => Promise.resolve('no')));
    fixture.clock.advanceMs(1);
    const afterLease = await semaphore.withBusinessSemaphore(BUSINESS_A, 1, () => Promise.resolve('yes'));

    // Assert
    expect(stillBusy.code).toBe('jobs.semaphore-busy');
    expect(afterLease).toBe('yes');
    crashed.finish('late');
    await crashedRun;
  });
});
