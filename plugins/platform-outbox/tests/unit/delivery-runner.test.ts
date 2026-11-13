import { OUTBOX_TOPICS, type TenantScope } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { OutboxConsumerRegistry } from '../../application/consumer-registry';
import { DeliveryRunner } from '../../application/delivery-runner';
import type { OutboxEnvironment, OutboxPorts } from '../../application/ports';

const LEAK = 'Key (email)=(a@b.c) already exists';
const scope = {} as TenantScope;

class HandlerError extends Error {}

function runnerWhoseHandlerThrows(error: Error): DeliveryRunner {
  const ports = {
    scopes: {
      plain: <T>(_id: string, work: (s: TenantScope) => Promise<T>) => work(scope),
      transactional: <T>(_id: string, work: (s: TenantScope) => Promise<T>) => work(scope),
    },
    store: {
      findDelivery: () => Promise.resolve({ status: 'enqueued' }),
      recordAttempt: () => Promise.resolve(1),
      lockDelivery: () => Promise.resolve({ status: 'enqueued' }),
      findEvent: () => Promise.resolve({ storeId: null, topic: OUTBOX_TOPICS[0], aggregateId: null, payload: {} }),
      finishDelivery: () => Promise.resolve(),
    },
  } as unknown as OutboxPorts;
  const registry = {
    bindDispatch: () => undefined,
    get: () => ({ handle: () => Promise.reject(error) }),
  } as unknown as OutboxConsumerRegistry;
  const environment: OutboxEnvironment = {
    logger: { error: () => undefined, warn: () => undefined },
    clock: { now: () => 0 },
  };
  return new DeliveryRunner(ports, registry, environment);
}

describe('DeliveryRunner retry', () => {
  it('rethrows a non-final failure to the queue without the handler message', async () => {
    const runner = runnerWhoseHandlerThrows(new HandlerError(LEAK));
    const data = { jobId: '1', outboxId: '1', createdAt: '2026-01-01T00:00:00.000Z', businessId: '1', consumer: 'c' };

    const thrown = await runner.run(data, { attempts: 1, retries: 3 }).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain('a@b.c');
    expect((thrown as Error).message).toBe('HandlerError (unexpected)');
  });
});
