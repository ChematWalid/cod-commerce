import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvictionPolicyVerifier } from '../application/eviction-policy.verifier';
import {
  LOGGER_CONTEXT,
  REDIS_EVICTION_GUARD_TIMEOUT_MS,
  REDIS_EVICTION_RECHECK_INTERVAL_MS,
} from '../domain/constants';
import { RedisConfigUnavailableError, RedisEvictionPolicyError } from '../domain/eviction-policy';
import { RedisEvictionPolicyReader } from '../infrastructure/redis-eviction.guard';
import { RedisProbe } from '../infrastructure/redis.probe';

/** A reader whose answers the test scripts, one per call; the last answer repeats. */
const scriptedReader = (...answers: (() => Promise<string>)[]): { readEvictionPolicy: () => Promise<string> } => ({
  readEvictionPolicy: () => (answers.length > 1 ? answers.shift() : answers[0])?.() ?? Promise.resolve(''),
});

const policy = (value: string) => () => Promise.resolve(value);
const unreachable = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:1'));
const hanging = () => new Promise<string>(() => undefined);

/** A connected Valkey client that answers `PING` and `CONFIG GET` as the test says. */
const fakeClient = (config: () => Promise<unknown> = () => Promise.resolve(['maxmemory-policy', 'noeviction'])) => ({
  status: 'ready',
  connect: vi.fn(() => Promise.resolve()),
  ping: vi.fn(() => Promise.resolve('PONG')),
  config: vi.fn(config),
});

/** 'accepted', or the rejection reason. */
const outcomeOf = (check: Promise<void>): Promise<unknown> =>
  check.then(
    () => 'accepted',
    (error: unknown) => error,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('EvictionPolicyVerifier.verifyAtBoot', () => {
  it('lets boot continue with a warning when Valkey is unreachable', async () => {
    const logger = { warn: vi.fn() };
    const verifier = new EvictionPolicyVerifier(scriptedReader(unreachable), logger);

    const outcome = await outcomeOf(verifier.verifyAtBoot());

    expect(outcome).toBe('accepted');
    expect(verifier.verified).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'), LOGGER_CONTEXT);
  });

  it('lets boot continue with a warning when reading the policy times out', async () => {
    vi.useFakeTimers();
    const logger = { warn: vi.fn() };
    const verifier = new EvictionPolicyVerifier(scriptedReader(hanging), logger);

    const booting = outcomeOf(verifier.verifyAtBoot());
    await vi.advanceTimersByTimeAsync(REDIS_EVICTION_GUARD_TIMEOUT_MS);

    expect(await booting).toBe('accepted');
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('fails boot when the policy is not noeviction', async () => {
    const verifier = new EvictionPolicyVerifier(scriptedReader(policy('allkeys-lru')), { warn: vi.fn() });

    const outcome = await outcomeOf(verifier.verifyAtBoot());

    expect(outcome).toBeInstanceOf(RedisEvictionPolicyError);
  });

  it('fails boot when Valkey refuses CONFIG', async () => {
    const refused = () => Promise.reject(new RedisConfigUnavailableError());
    const verifier = new EvictionPolicyVerifier(scriptedReader(refused), { warn: vi.fn() });

    const outcome = await outcomeOf(verifier.verifyAtBoot());

    expect(outcome).toBeInstanceOf(RedisConfigUnavailableError);
  });

  it('marks the policy verified when it is noeviction', async () => {
    const verifier = new EvictionPolicyVerifier(scriptedReader(policy('noeviction')), { warn: vi.fn() });

    await verifier.verifyAtBoot();

    expect(verifier.verified).toBe(true);
  });
});

describe('RedisProbe', () => {
  it('fails with RedisEvictionPolicyError when the unverified policy turns out wrong', async () => {
    const client = fakeClient();
    const verifier = new EvictionPolicyVerifier(scriptedReader(unreachable, policy('allkeys-lru')), { warn: vi.fn() });
    await verifier.verifyAtBoot();

    const outcome = await outcomeOf(new RedisProbe(client, verifier).check());

    expect(outcome).toBeInstanceOf(RedisEvictionPolicyError);
    expect(client.ping).not.toHaveBeenCalled();
  });

  it('only pings once the policy has been verified', async () => {
    const client = fakeClient();
    const reader = scriptedReader(unreachable, policy('noeviction'));
    const readPolicy = vi.spyOn(reader, 'readEvictionPolicy');
    const verifier = new EvictionPolicyVerifier(reader, { warn: vi.fn() });
    await verifier.verifyAtBoot();
    const probe = new RedisProbe(client, verifier);

    await probe.check();
    await probe.check();

    expect(readPolicy).toHaveBeenCalledTimes(2);
    expect(client.ping).toHaveBeenCalledOnce();
  });
});

describe('RedisProbe after boot', () => {
  it('detects a policy changed after boot once the verification expires', async () => {
    vi.useFakeTimers();
    const client = fakeClient();
    const verifier = new EvictionPolicyVerifier(scriptedReader(policy('noeviction'), policy('allkeys-lru')), {
      warn: vi.fn(),
    });
    await verifier.verifyAtBoot();
    const probe = new RedisProbe(client, verifier);
    expect(await outcomeOf(probe.check())).toBe('accepted');

    vi.advanceTimersByTime(REDIS_EVICTION_RECHECK_INTERVAL_MS);
    const outcome = await outcomeOf(probe.check());

    expect(outcome).toBeInstanceOf(RedisEvictionPolicyError);
    expect(verifier.verified).toBe(false);
  });

  it('stays unverified after a failed re-check, so the next check reads the policy again', async () => {
    vi.useFakeTimers();
    const reader = scriptedReader(policy('noeviction'), policy('allkeys-lru'), policy('noeviction'));
    const readPolicy = vi.spyOn(reader, 'readEvictionPolicy');
    const verifier = new EvictionPolicyVerifier(reader, { warn: vi.fn() });
    await verifier.verifyAtBoot();
    const probe = new RedisProbe(fakeClient(), verifier);

    vi.advanceTimersByTime(REDIS_EVICTION_RECHECK_INTERVAL_MS);
    await outcomeOf(probe.check());
    const recovered = await outcomeOf(probe.check());

    expect(recovered).toBe('accepted');
    expect(readPolicy).toHaveBeenCalledTimes(3);
  });

  it('shares one policy read between concurrent re-checks', async () => {
    const reader = scriptedReader(policy('noeviction'));
    const readPolicy = vi.spyOn(reader, 'readEvictionPolicy');
    const verifier = new EvictionPolicyVerifier(reader, { warn: vi.fn() });

    await Promise.all([verifier.verify(), verifier.verify(), verifier.verify()]);

    expect(readPolicy).toHaveBeenCalledOnce();
  });

  it('does not re-read the policy within the re-check interval', async () => {
    vi.useFakeTimers();
    const reader = scriptedReader(policy('noeviction'));
    const readPolicy = vi.spyOn(reader, 'readEvictionPolicy');
    const verifier = new EvictionPolicyVerifier(reader, { warn: vi.fn() });
    await verifier.verifyAtBoot();
    const probe = new RedisProbe(fakeClient(), verifier);

    vi.advanceTimersByTime(REDIS_EVICTION_RECHECK_INTERVAL_MS - 1);
    await probe.check();

    expect(readPolicy).toHaveBeenCalledOnce();
  });
});

describe('RedisEvictionPolicyReader', () => {
  it('reads maxmemory-policy from CONFIG GET', async () => {
    const reader = new RedisEvictionPolicyReader(fakeClient());

    expect(await reader.readEvictionPolicy()).toBe('noeviction');
  });

  it.each([
    "ERR unknown command 'CONFIG', with args beginning with: 'GET' 'maxmemory-policy' ",
    "NOPERM User default has no permissions to run the 'config|get' command",
  ])('maps a refused CONFIG to RedisConfigUnavailableError (%s)', async (reply) => {
    const reader = new RedisEvictionPolicyReader(fakeClient(() => Promise.reject(new Error(reply))));

    const outcome = await reader.readEvictionPolicy().catch((error: unknown) => error);

    expect(outcome).toBeInstanceOf(RedisConfigUnavailableError);
  });

  it('lets a connection error through unchanged', async () => {
    const reader = new RedisEvictionPolicyReader(fakeClient(() => Promise.reject(new Error('Connection is closed.'))));

    const outcome = await reader.readEvictionPolicy().catch((error: unknown) => error);

    expect(outcome).toMatchObject({ message: 'Connection is closed.' });
  });
});
