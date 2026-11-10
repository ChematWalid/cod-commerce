import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BREAKER_OPEN_MS, BREAKER_WINDOW_MS } from '../../domain/constants';
import { CircuitOpenError } from '../../domain/errors';
import { ValkeyCircuitBreaker } from '../../infrastructure/valkey-circuit-breaker';
import { connectFixture, heldWork, releaseFixture, type ValkeyFixture } from '../fakes/valkey-fixture';

const ACCOUNT = { provider: 'demo-carrier', accountId: 'account-1' } as const;
const SECOND_MS = 1000;

let fixture: ValkeyFixture;
let breaker: ValkeyCircuitBreaker;

beforeEach(async () => {
  fixture = await connectFixture();
  breaker = new ValkeyCircuitBreaker(fixture.valkey, { appEnv: fixture.appEnv, clock: fixture.clock });
});

afterEach(async () => {
  await releaseFixture(fixture);
});

const failing = (): Promise<never> => Promise.reject(new Error('provider 503'));

/** Fails one call at the current clock time. */
async function failOnce(): Promise<void> {
  await expect(breaker.withCircuitBreaker(ACCOUNT, failing)).rejects.toThrow('provider 503');
}

/** Fails one call at each offset (seconds) from the clock's current time, moving the clock forward. */
async function failAtSeconds(offsets: readonly number[]): Promise<void> {
  const start = fixture.clock.now();
  for (const offset of offsets) {
    fixture.clock.advanceMs(start + offset * SECOND_MS - fixture.clock.now());
    await failOnce();
  }
}

async function openError(run: Promise<unknown>): Promise<CircuitOpenError> {
  const error: unknown = await run.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(CircuitOpenError);
  return error as CircuitOpenError;
}

/** Opens the breaker with five failures at the current time; the clock does not move. */
async function openNow(): Promise<void> {
  await failAtSeconds([0, 0, 0, 0, 0]);
  expect(await breaker.stateOf(ACCOUNT)).toBe('open');
}

describe('ValkeyCircuitBreaker: opening', () => {
  it('stays closed after four failures within 120 s and opens on the fifth', async () => {
    // Act
    await failAtSeconds([0, 30, 60, 90]);
    const afterFour = await breaker.stateOf(ACCOUNT);
    await failAtSeconds([10]);

    // Assert
    expect(afterFour).toBe('closed');
    expect(await breaker.stateOf(ACCOUNT)).toBe('open');
  });

  it('does not open on a fifth failure at t+150 s, after the first fell out of the window', async () => {
    // Act
    await failAtSeconds([0, 30, 60, 90, 150]);

    // Assert
    expect(await breaker.stateOf(ACCOUNT)).toBe('closed');
  });

  it('keeps an account apart from another of the same provider', async () => {
    // Arrange
    await openNow();

    // Act
    const other = await breaker.withCircuitBreaker({ ...ACCOUNT, accountId: 'account-2' }, () =>
      Promise.resolve('ran'),
    );

    // Assert
    expect(other).toBe('ran');
  });
});

describe('ValkeyCircuitBreaker: while open', () => {
  it('does not call work and counts retryAfterMs down', async () => {
    // Arrange
    await openNow();
    const work = heldWork<string>();

    // Act
    const atOpen = await openError(breaker.withCircuitBreaker(ACCOUNT, work.work));
    fixture.clock.advanceMs(20 * SECOND_MS);
    const later = await openError(breaker.withCircuitBreaker(ACCOUNT, work.work));

    // Assert
    expect(work.calls()).toBe(0);
    expect(atOpen.code).toBe('jobs.circuit-open');
    expect(atOpen.retryAfterMs).toBe(BREAKER_OPEN_MS);
    expect(later.retryAfterMs).toBe(BREAKER_OPEN_MS - 20 * SECOND_MS);
  });

  it('is half-open 60 s after opening, not before', async () => {
    // Arrange
    await openNow();

    // Act
    fixture.clock.advanceMs(BREAKER_OPEN_MS - 1);
    const justBefore = await breaker.stateOf(ACCOUNT);
    fixture.clock.advanceMs(1);

    // Assert
    expect(justBefore).toBe('open');
    expect(await breaker.stateOf(ACCOUNT)).toBe('half-open');
  });
});

describe('ValkeyCircuitBreaker: half-open probe', () => {
  it('lets exactly one of two concurrent callers probe', async () => {
    // Arrange
    await openNow();
    fixture.clock.advanceMs(BREAKER_OPEN_MS);
    const first = heldWork<string>();
    const second = heldWork<string>();

    // Act
    const runs = [breaker.withCircuitBreaker(ACCOUNT, first.work), breaker.withCircuitBreaker(ACCOUNT, second.work)];
    const rejected = await Promise.race(runs.map((run) => run.catch((error: unknown) => error)));
    first.finish('probe');
    second.finish('probe');
    const settled = await Promise.allSettled(runs);

    // Assert
    expect(rejected).toBeInstanceOf(CircuitOpenError);
    expect(first.calls() + second.calls()).toBe(1);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('closes on a probe success and clears the failures', async () => {
    // Arrange
    await openNow();
    fixture.clock.advanceMs(BREAKER_OPEN_MS);

    // Act
    const probe = await breaker.withCircuitBreaker(ACCOUNT, () => Promise.resolve('healthy'));
    const afterProbe = await breaker.stateOf(ACCOUNT);
    await failAtSeconds([0, 0, 0, 0]);

    // Assert: four new failures do not reopen it, so the earlier five were cleared
    expect(probe).toBe('healthy');
    expect(afterProbe).toBe('closed');
    expect(await breaker.stateOf(ACCOUNT)).toBe('closed');
  });

  it('opens again from the time of a failed probe', async () => {
    // Arrange
    await openNow();
    fixture.clock.advanceMs(BREAKER_OPEN_MS + 5 * SECOND_MS);

    // Act
    await failOnce();
    const afterProbe = await breaker.stateOf(ACCOUNT);
    const retry = await openError(breaker.withCircuitBreaker(ACCOUNT, () => Promise.resolve('no')));
    fixture.clock.advanceMs(BREAKER_OPEN_MS);

    // Assert
    expect(afterProbe).toBe('open');
    expect(retry.retryAfterMs).toBe(BREAKER_OPEN_MS);
    expect(await breaker.stateOf(ACCOUNT)).toBe('half-open');
  });

  it('forgets failures older than the window when counting', async () => {
    // Act
    await failAtSeconds([0, 0, 0, 0]);
    fixture.clock.advanceMs(BREAKER_WINDOW_MS);
    await failOnce();

    // Assert
    expect(await breaker.stateOf(ACCOUNT)).toBe('closed');
  });
});
