import { performance } from 'node:perf_hooks';
import type { Redis } from 'ioredis';
import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadinessService } from '../application/readiness.service';
import type { ReadinessProbe } from '../domain/readiness';
import { PostgresProbe } from '../infrastructure/postgres.probe';
import { EvictionPolicyVerifier } from '../application/eviction-policy.verifier';
import { RedisEvictionPolicyError } from '../domain/eviction-policy';
import { MigrationsProbe, PendingMigrationsError } from '../infrastructure/migrations.probe';
import { RedisEvictionPolicyReader } from '../infrastructure/redis-eviction.guard';
import { createProbeRedisClient, RedisProbe } from '../infrastructure/redis.probe';

/** A port nothing listens on, so connections are refused. */
const CLOSED_PORT_REDIS_URL = 'redis://127.0.0.1:1';
const CLOSED_PORT_DATABASE_URL = 'postgresql://cod:unused@127.0.0.1:1/cod';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set: copy apps/server/.env.example to apps/server/.env`);
  }
  return value;
};

/** Runs one probe through the readiness service, as `/readyz` does, and times it. */
const runProbe = async (probe: ReadinessProbe): Promise<{ ok: boolean; elapsedMs: number }> => {
  const started = performance.now();
  const report = await new ReadinessService([probe]).check();
  return { ok: report.checks[probe.name].ok, elapsedMs: performance.now() - started };
};

/** 'accepted', or the rejection reason. */
const outcomeOf = (check: Promise<void>): Promise<unknown> =>
  check.then(
    () => 'accepted',
    (error: unknown) => error,
  );

const silentLogger = { warn: vi.fn() };
const cleanups: (() => Promise<void>)[] = [];

const pool = (connectionString: string): Pool => {
  const created = new Pool({ connectionString });
  cleanups.push(() => created.end());
  return created;
};

/** A verifier over the real eviction-policy reader of `client`. */
const verifierOf = (client: Redis): EvictionPolicyVerifier =>
  new EvictionPolicyVerifier(new RedisEvictionPolicyReader(client), silentLogger);

const redis = (url: string): Redis => {
  const client = createProbeRedisClient(url, silentLogger);
  cleanups.push(() => {
    client.disconnect();
    return Promise.resolve();
  });
  return client;
};

const redisProbe = (url: string): RedisProbe => {
  const client = redis(url);
  return new RedisProbe(client, verifierOf(client));
};

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('PostgresProbe', () => {
  it('passes against DATABASE_URL_DIRECT', async () => {
    const probe = new PostgresProbe(pool(requireEnv('DATABASE_URL_DIRECT')));

    const result = await runProbe(probe);

    expect(result.ok).toBe(true);
  });

  it('fails within its budget against a closed port', async () => {
    const probe = new PostgresProbe(pool(CLOSED_PORT_DATABASE_URL));

    const result = await runProbe(probe);

    expect(result.ok).toBe(false);
    expect(result.elapsedMs).toBeLessThan(700);
  });
});

describe('RedisProbe', () => {
  it('passes against REDIS_URL', async () => {
    const probe = redisProbe(requireEnv('REDIS_URL'));

    const result = await runProbe(probe);

    expect(result.ok).toBe(true);
  });

  it('fails within its budget against redis://127.0.0.1:1', async () => {
    const probe = redisProbe(CLOSED_PORT_REDIS_URL);

    const result = await runProbe(probe);

    expect(result.ok).toBe(false);
    expect(result.elapsedMs).toBeLessThan(400);
  });
});

describe('EvictionPolicyVerifier', () => {
  it('accepts the compose Valkey at boot and rejects allkeys-lru', async () => {
    const verifier = verifierOf(redis(requireEnv('REDIS_URL')));
    const evicting = new EvictionPolicyVerifier(
      { readEvictionPolicy: () => Promise.resolve('allkeys-lru') },
      silentLogger,
    );

    const accepted = await outcomeOf(verifier.verifyAtBoot());
    const rejected = await outcomeOf(evicting.verifyAtBoot());

    expect(accepted).toBe('accepted');
    expect(verifier.verified).toBe(true);
    expect(rejected).toBeInstanceOf(RedisEvictionPolicyError);
  });

  it('lets boot continue when Valkey is unreachable', async () => {
    const verifier = verifierOf(redis(CLOSED_PORT_REDIS_URL));

    const outcome = await outcomeOf(verifier.verifyAtBoot());

    expect(outcome).toBe('accepted');
    expect(verifier.verified).toBe(false);
  });
});

describe('MigrationsProbe', () => {
  it('reports pending when the migrations table does not exist', async () => {
    const db = pool(requireEnv('DATABASE_URL_DIRECT'));
    const source = {
      options: { migrationsTableName: 'cod_probe_missing_migrations' },
      migrations: [],
      query: async (sql: string): Promise<unknown> => (await db.query(sql)).rows,
    };

    const outcome = await outcomeOf(new MigrationsProbe(source).check());

    expect(outcome).toBeInstanceOf(PendingMigrationsError);
  });
});
