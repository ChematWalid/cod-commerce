import { FLAG_KEYS } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { FeatureFlags } from '../../application/feature-flags.service';
import type { FeatureFlagsPorts } from '../../application/ports';
import { FLAG_SNAPSHOT_TTL_MS } from '../../domain/constants';
import type { FlagSnapshot } from '../../domain/snapshot';
import { ManualClock } from '../fixtures/manual-clock';

const KEY = FLAG_KEYS.ai;
const BUSINESS = '7000000000000000001';

const snapshotOf = (defaultEnabled: boolean, overrides: FlagSnapshot['flags'][string]['overrides'] = []): FlagSnapshot => ({
  flags: { [KEY]: { description: 'd', defaultEnabled, rolloutPercent: 100, updatedAt: '2026-01-01T00:00:00.000Z', overrides } },
});

function setup(initial: FlagSnapshot) {
  const clock = new ManualClock(1_000_000);
  let database = initial;
  const store = { loadSnapshot: vi.fn(() => Promise.resolve(database)) };
  const cache = { read: vi.fn(() => Promise.resolve(undefined as FlagSnapshot | undefined)), write: vi.fn(() => Promise.resolve(true)), invalidate: vi.fn(() => Promise.resolve(true)) };
  const plans = { planKeyOf: vi.fn(() => Promise.resolve('pro' as string | undefined)) };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const ports = {
    store, cache, plans, clock, logger,
    subjects: { subjectOf: () => ({ businessId: BUSINESS }) },
  } as unknown as FeatureFlagsPorts;
  return { flags: new FeatureFlags(ports), clock, store, cache, plans, logger, setDatabase: (next: FlagSnapshot) => { database = next; } };
}

describe('FeatureFlags', () => {
  it('reads the database once per snapshot life and writes the shared snapshot', async () => {
    // Arrange
    const { flags, store, cache, clock } = setup(snapshotOf(true));

    // Act
    await flags.isEnabledFor({}, KEY);
    await flags.isEnabledFor({}, KEY);
    clock.advance(FLAG_SNAPSHOT_TTL_MS);
    await flags.isEnabledFor({}, KEY);

    // Assert
    expect(store.loadSnapshot).toHaveBeenCalledTimes(2);
    expect(cache.write).toHaveBeenCalledTimes(2);
  });

  it('takes the shared snapshot before the database', async () => {
    // Arrange
    const { flags, store, cache } = setup(snapshotOf(true));
    cache.read.mockResolvedValue(snapshotOf(false));

    // Act and Assert
    expect(await flags.isEnabledFor({}, KEY)).toBe(false);
    expect(store.loadSnapshot).not.toHaveBeenCalled();
  });

  it('forget makes the next question read again', async () => {
    // Arrange
    const { flags, setDatabase } = setup(snapshotOf(true));
    expect(await flags.isEnabledFor({}, KEY)).toBe(true);
    setDatabase(snapshotOf(false));

    // Act
    flags.forget();

    // Assert
    expect(await flags.isEnabledFor({}, KEY)).toBe(false);
  });

  it('a question asked after forget does not join a refresh that started before it', async () => {
    // Arrange
    const { flags, store, setDatabase } = setup(snapshotOf(true));
    let release: (snapshot: FlagSnapshot) => void = () => undefined;
    store.loadSnapshot.mockImplementationOnce(() => new Promise<FlagSnapshot>((resolve) => { release = resolve; }));
    const before = flags.isEnabledFor({}, KEY);
    await Promise.resolve();
    await Promise.resolve();
    setDatabase(snapshotOf(false));

    // Act
    flags.forget();
    const after = flags.isEnabledFor({}, KEY);
    release(snapshotOf(true));

    // Assert
    expect(await before).toBe(true);
    expect(await after).toBe(false);
  });

  it('does not write a snapshot read before a change to the shared cache', async () => {
    // Arrange
    const { flags, store, cache } = setup(snapshotOf(true));
    let release: (snapshot: FlagSnapshot) => void = () => undefined;
    store.loadSnapshot.mockImplementationOnce(() => new Promise<FlagSnapshot>((resolve) => { release = resolve; }));
    const pending = flags.isEnabledFor({}, KEY);
    await Promise.resolve();
    await Promise.resolve();

    // Act
    flags.forget();
    release(snapshotOf(true));
    await pending;

    // Assert
    expect(cache.write).not.toHaveBeenCalled();
  });

  it('reads a seeded flag the database lacks as its seed, not as off', async () => {
    // Arrange
    const { flags } = setup({ flags: {} });

    // Act and Assert
    expect(await flags.isEnabledFor({}, KEY)).toBe(true);
  });

  it('serves the previous snapshot when a refresh fails, and says so', async () => {
    // Arrange
    const { flags, store, clock, logger } = setup(snapshotOf(true));
    await flags.isEnabledFor({}, KEY);
    store.loadSnapshot.mockRejectedValue(new Error('database down'));
    clock.advance(FLAG_SNAPSHOT_TTL_MS);

    // Act and Assert
    expect(await flags.isEnabledFor({}, KEY)).toBe(true);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('does not cache the previous snapshot when a refresh that began before a change fails', async () => {
    // Arrange
    const { flags, store, clock, setDatabase } = setup(snapshotOf(true));
    expect(await flags.isEnabledFor({}, KEY)).toBe(true);
    clock.advance(FLAG_SNAPSHOT_TTL_MS);
    let fail: (error: Error) => void = () => undefined;
    store.loadSnapshot.mockImplementationOnce(() => new Promise<FlagSnapshot>((_resolve, reject) => { fail = reject; }));
    const pending = flags.isEnabledFor({}, KEY);
    await Promise.resolve();
    await Promise.resolve();

    // Act: the change lands while the refresh is reading, then the refresh fails.
    setDatabase(snapshotOf(false));
    flags.forget();
    fail(new Error('database down'));
    await pending;

    // Assert: nothing stale was cached, so the next question reads the changed data at once.
    expect(await flags.isEnabledFor({}, KEY)).toBe(false);
  });

  it('throws when the first load fails: there is nothing older to serve', async () => {
    // Arrange
    const { flags, store } = setup(snapshotOf(true));
    store.loadSnapshot.mockRejectedValue(new Error('database down'));

    // Act and Assert
    await expect(flags.isEnabledFor({}, KEY)).rejects.toThrow('database down');
  });

  it('asks for the business plan only when the flag has a plan override', async () => {
    // Arrange
    const withPlan = setup(snapshotOf(false, [{ scope: 'plan', scopeId: 'pro', enabled: true }]));
    const without = setup(snapshotOf(false));

    // Act
    const planned = await withPlan.flags.isEnabledFor({ businessId: BUSINESS }, KEY);
    await without.flags.isEnabledFor({ businessId: BUSINESS }, KEY);

    // Assert
    expect(planned).toBe(true);
    expect(withPlan.plans.planKeyOf).toHaveBeenCalledWith(BUSINESS);
    expect(without.plans.planKeyOf).not.toHaveBeenCalled();
  });

  it("isEnabled takes the subject from the request's tenant", async () => {
    // Arrange
    const { flags } = setup(snapshotOf(false, [{ scope: 'business', scopeId: BUSINESS, enabled: true }]));

    // Act and Assert
    expect(await flags.isEnabled({}, KEY)).toBe(true);
  });
});
