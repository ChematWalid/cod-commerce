import { describe, expect, it } from 'vitest';
import {
  DURABLE_JOB_KINDS,
  InvalidDurableJobIdError,
  QUEUES,
  STOCK_VENDURE_QUEUES,
  WORKER_POOLS,
  activeQueuesFor,
  durableJobId,
  isQueueName,
  type QueueName,
} from '../src/queues.js';

const ADR_0013_QUEUES = [
  'inbound-webhooks',
  'order-effects',
  'dispatch',
  'notifications',
  'storefront-revalidate',
  'domains',
  'capi',
  'outbound-webhooks',
  'integrations',
  'carrier-polling',
  'analytics',
  'ai',
  'imports-exports',
  'asset-derivatives',
  'documents',
] as const;

const HOUR_MS = 3_600_000;
const allNames = Object.keys(QUEUES) as QueueName[];

describe('queue registry', () => {
  it('holds every ADR 0013 queue and the three stock queues', () => {
    for (const name of [...ADR_0013_QUEUES, ...STOCK_VENDURE_QUEUES]) {
      expect(isQueueName(name)).toBe(true);
    }
    expect([...STOCK_VENDURE_QUEUES].sort()).toEqual([
      'apply-collection-filters',
      'clean-sessions',
      'update-search-index',
    ]);
  });

  it('holds the queues the platform plumbing adds', () => {
    for (const name of ['outbox-relay', 'platform-maintenance', 'auth-email']) {
      expect(isQueueName(name)).toBe(true);
    }
  });

  it('puts auth-email in the critical pool with 5 attempts (D42)', () => {
    expect(QUEUES['auth-email']).toMatchObject({ pool: 'critical', attempts: 5 });
  });

  it('rejects names outside the registry', () => {
    expect(isQueueName('nope')).toBe(false);
    expect(isQueueName('toString')).toBe(false);
  });

  it('gives every queue positive concurrency and attempts', () => {
    for (const name of allNames) {
      expect(QUEUES[name].concurrency).toBeGreaterThan(0);
      expect(QUEUES[name].attempts).toBeGreaterThanOrEqual(1);
    }
  });

  it('spreads capi retries over about 24 hours', () => {
    const { attempts, backoff } = QUEUES.capi;
    const total = Array.from({ length: attempts - 1 }, (_, i) => backoff.delayMs * 2 ** i).reduce((a, b) => a + b, 0);

    expect(backoff.type).toBe('exponential');
    expect(total).toBeGreaterThan(23 * HOUR_MS);
    expect(total).toBeLessThan(25 * HOUR_MS);
    expect(QUEUES['outbound-webhooks']).toEqual(QUEUES.capi);
  });
});

describe('worker pools', () => {
  it('partitions the queue names between critical and bulk', () => {
    const critical = activeQueuesFor('critical');
    const bulk = activeQueuesFor('bulk');

    expect(critical.filter((n) => bulk.includes(n))).toEqual([]);
    expect([...critical, ...bulk].sort()).toEqual([...allNames].sort());
    expect(critical).toContain('inbound-webhooks');
    expect(bulk).toContain('capi');
  });

  it('lists nothing for the all pool, which means every queue', () => {
    expect(activeQueuesFor('all')).toEqual([]);
    expect(WORKER_POOLS).toEqual(['critical', 'bulk', 'all']);
  });
});

describe('durableJobId', () => {
  it('joins the kind and parts with a dash', () => {
    expect(durableJobId(DURABLE_JOB_KINDS.outboxDelivery, '7301', 'demo-log')).toBe('od-7301-demo-log');
    expect(durableJobId('ob', '7301')).toBe('ob-7301');
    expect(durableJobId('kek', '12', 'k2')).toBe('kek-12-k2');
  });

  it('is never integer-only, which BullMQ refuses', () => {
    for (const kind of Object.values(DURABLE_JOB_KINDS)) {
      expect(Number.isInteger(Number(durableJobId(kind, '123')))).toBe(false);
    }
  });

  it('rejects an empty part or one containing a colon', () => {
    expect(() => durableJobId('ob', '')).toThrow(InvalidDurableJobIdError);
    expect(() => durableJobId('od', '1', '')).toThrow(InvalidDurableJobIdError);
    expect(() => durableJobId('od', '1', 'a:b')).toThrow(InvalidDurableJobIdError);
    expect(() => durableJobId('ob')).toThrow(InvalidDurableJobIdError);
    expect(() => durableJobId('od', '7301-x', 'demo-log')).toThrow(InvalidDurableJobIdError);
  });
});
