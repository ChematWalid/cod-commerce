import { DURABLE_JOB_KINDS, durableJobId } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { KekRotationService } from '../../application/kek-rotation.service';
import type { EnvelopeCipherPort, KekRing } from '../../domain/ports/envelope-cipher.port';
import type { KekRewrapQueuePort, KekRewrapStorePort, RetiredKekScanPort } from '../../domain/ports/kek-rotation.ports';

const NOW = new Date('2026-11-12T03:30:00.000Z');
const ring: KekRing = { activeKid: 'k2', key: () => Buffer.alloc(32) };
const BUSINESSES = ['10', '20', '30', '40', '50'];

function build(options: { failFor?: string; pageSize?: number; remaining?: number }) {
  const staleBusinesses = vi.fn<RetiredKekScanPort['staleBusinesses']>((_kid, after, limit) =>
    Promise.resolve(BUSINESSES.filter((id) => after === null || BigInt(id) > BigInt(after)).slice(0, limit)),
  );
  const countStale = vi.fn<RetiredKekScanPort['countStale']>(() => Promise.resolve(options.remaining ?? 0));
  const enqueue = vi.fn<KekRewrapQueuePort['enqueue']>((job) =>
    job.businessId === options.failFor ? Promise.reject(new Error('queue down: secret-detail')) : Promise.resolve(),
  );
  const warn = vi.fn();
  const service = new KekRotationService({
    scan: { staleBusinesses, countStale },
    queue: { enqueue },
    store: {} as KekRewrapStorePort,
    logger: { warn },
    ring,
    cipher: {} as EnvelopeCipherPort,
    clock: { now: () => NOW.getTime() },
    ...(options.pageSize === undefined ? {} : { scanBatchSize: options.pageSize }),
  });
  return { service, staleBusinesses, countStale, enqueue, warn };
}

describe('KekRotationService.enqueueStale', () => {
  it('pages with a keyset on the last business id and queues each business once', async () => {
    const { service, staleBusinesses, enqueue } = build({ pageSize: 2 });

    const result = await service.enqueueStale(NOW);

    expect(result).toEqual({ enqueued: 5, remainingOnRetiredKeks: 0 });
    expect(staleBusinesses.mock.calls).toEqual([
      ['k2', null, 2],
      ['k2', '20', 2],
      ['k2', '40', 2],
    ]);
    expect(enqueue.mock.calls.map(([job]) => job.businessId)).toEqual(BUSINESSES);
    expect(enqueue.mock.calls[0]?.[0]).toEqual({
      jobId: durableJobId(DURABLE_JOB_KINDS.kekRewrap, '10', 'k2'),
      businessId: '10',
      enqueuedAt: NOW.toISOString(),
    });
  });

  it('asks once more when the last page is exactly full, and stops on the empty page', async () => {
    const { service, staleBusinesses } = build({ pageSize: 5 });

    await service.enqueueStale(NOW);

    expect(staleBusinesses.mock.calls.map(([, after]) => after)).toEqual([null, '50']);
  });

  it('logs a business whose enqueue rejects, does not count it and keeps going', async () => {
    const { service, enqueue, warn } = build({ pageSize: 2, failFor: '30', remaining: 1 });

    const result = await service.enqueueStale(NOW);

    expect(result).toEqual({ enqueued: 4, remainingOnRetiredKeks: 1 });
    expect(enqueue).toHaveBeenCalledTimes(5);
    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('business 30'));
    expect(warn.mock.calls[0]?.[0]).not.toContain('secret-detail');
  });

  it('reports the remaining count from the active kid after the scan', async () => {
    const { service, countStale } = build({ remaining: 4 });

    const result = await service.enqueueStale(NOW);

    expect(result.remainingOnRetiredKeks).toBe(4);
    expect(countStale).toHaveBeenCalledExactlyOnceWith('k2');
  });
});
