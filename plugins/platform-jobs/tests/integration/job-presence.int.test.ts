import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BullMqJobPresence } from '../../infrastructure/bullmq-job-presence';
import { PooledJobQueueStrategy } from '../../infrastructure/pooled-job-queue.strategy';
import { testValkeyUrl } from '../fakes/valkey-fixture';

describe('BullMqJobPresence against a real queue', () => {
  const prefix = `test-${randomUUID()}`;
  let queue: Queue;
  let presence: BullMqJobPresence;

  beforeAll(() => {
    const url = new URL(testValkeyUrl());
    queue = new Queue('presence', {
      prefix,
      connection: { host: url.hostname, port: Number(url.port), db: Number(url.pathname.slice(1)) },
    });
    const strategy = Object.create(PooledJobQueueStrategy.prototype) as PooledJobQueueStrategy;
    strategy.bullQueueOf = () => queue;
    presence = new BullMqJobPresence({ jobQueueOptions: { jobQueueStrategy: strategy } } as never);
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('reports a delayed job as delayed with the time it comes due, and a missing job as missing', async () => {
    // Arrange
    const before = Date.now();
    await queue.add('job', {}, { jobId: 'delayed-1', delay: 3_600_000 });

    // Act
    const state = await presence.stateOf('order-effects', 'delayed-1');
    const dueAt = await presence.dueAtOf('order-effects', 'delayed-1');

    // Assert
    expect(state).toBe('delayed');
    expect(dueAt?.getTime()).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(dueAt?.getTime()).toBeLessThan(Date.now() + 3_600_000 + 1000);
    expect(await presence.stateOf('order-effects', 'nope')).toBe('missing');
    expect(await presence.dueAtOf('order-effects', 'nope')).toBeNull();
  });
});
