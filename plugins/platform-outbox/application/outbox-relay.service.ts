import { DURABLE_JOB_KINDS, durableJobId, toBusinessId } from '@cod/shared';
import type { OutboxEventKey, OutboxRelayJobData } from '../domain/outbox-event';
import type { OutboxConsumerRegistry } from './consumer-registry';
import type { OutboxEnvironment, OutboxPorts } from './ports';

/**
 * Routes one event (D104). In one transaction it inserts a delivery per matching consumer and marks the event
 * `relayed`; after commit it queues the deliveries still `pending`. Running it again for the same event makes no
 * second delivery and queues only what an earlier run did not get to, so a retried or duplicated job is harmless.
 */
export class OutboxRelayService {
  constructor(
    private readonly ports: OutboxPorts,
    private readonly registry: OutboxConsumerRegistry,
    private readonly environment: OutboxEnvironment,
  ) {}

  /** The processor of the `outbox-relay` queue. */
  async relay(data: OutboxRelayJobData): Promise<void> {
    const businessId = toBusinessId(data.businessId);
    const key: OutboxEventKey = { id: data.outboxId, createdAt: new Date(data.createdAt) };
    const found = await this.ports.scopes.transactional(businessId, async (scope) => {
      const event = await this.ports.store.lockEvent(scope, key);
      if (event === null) return false;
      if (event.status !== 'pending') return true;
      const at = new Date(this.environment.clock.now());
      const matching = this.registry.forTopic(event.topic);
      await this.ports.store.insertDeliveries(
        scope,
        matching.map((consumer) => ({ createdAt: key.createdAt, outboxId: key.id, consumer: consumer.name, at })),
      );
      await this.ports.store.markRelayed(scope, key, at);
      return true;
    });
    if (!found) {
      this.environment.logger.warn(
        `Outbox event ${data.outboxId} of business ${data.businessId} was not found; nothing relayed`,
      );
      return;
    }
    await this.enqueuePending(data, key);
  }

  private async enqueuePending(data: OutboxRelayJobData, key: OutboxEventKey): Promise<void> {
    const businessId = toBusinessId(data.businessId);
    await this.ports.scopes.plain(businessId, async (scope) => {
      for (const name of await this.ports.store.pendingConsumers(scope, key)) {
        const consumer = this.registry.get(name);
        await this.ports.queues.enqueueDelivery(consumer.queue, {
          jobId: durableJobId(DURABLE_JOB_KINDS.outboxDelivery, data.outboxId, name),
          outboxId: data.outboxId,
          createdAt: data.createdAt,
          businessId: data.businessId,
          consumer: name,
        });
        await this.ports.store.markEnqueued(
          scope,
          { createdAt: key.createdAt, outboxId: key.id, consumer: name },
          new Date(this.environment.clock.now()),
        );
      }
    });
  }
}
