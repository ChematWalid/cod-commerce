import { type BusinessId, DomainError, isOutboxTopic, type OutboxTopic, toBusinessId } from '@cod/shared';
import { OUTBOX_LAST_ERROR_MAX_LENGTH } from '../domain/constants';
import { isTerminalDelivery } from '../domain/delivery-status';
import { OutboxDeliveryMissingError, OutboxParkError } from '../domain/errors';
import type {
  OutboxDelivery,
  OutboxDeliveryJobData,
  OutboxDeliveryKey,
  OutboxEventKey,
  OutboxEventRecord,
} from '../domain/outbox-event';
import type { OutboxConsumerRegistry } from './consumer-registry';
import type { JobAttemptInfo, OutboxEnvironment, OutboxPorts } from './ports';

/** What a delivery keeps of a failure: its name and message, cut to the column. Never the payload (D105). */
function describeFailure(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : typeof error;
  return text.slice(0, OUTBOX_LAST_ERROR_MAX_LENGTH);
}

function deliveryOf(data: OutboxDeliveryJobData, event: OutboxEventRecord, attempt: number): OutboxDelivery {
  return {
    outboxId: data.outboxId,
    createdAt: data.createdAt,
    businessId: data.businessId,
    storeId: event.storeId,
    topic: event.topic as OutboxTopic,
    aggregateId: event.aggregateId,
    payload: event.payload,
    consumer: data.consumer,
    idempotencyKey: `${data.outboxId}:${data.consumer}`,
    attempt,
  };
}

/**
 * The wrapper around every consumer (D105). It skips a delivery that is over, counts the attempt (committed on its
 * own, so a failure never loses it), and runs the handler and the `done` update in one transaction: the handler's
 * database effects happen exactly once. A failure retries until the last attempt, which ends `failed`; a handler
 * throwing {@link OutboxParkError} ends `parked`.
 */
export class DeliveryRunner {
  constructor(
    private readonly ports: OutboxPorts,
    private readonly registry: OutboxConsumerRegistry,
    private readonly environment: OutboxEnvironment,
  ) {
    registry.bindDispatch((data, job) => this.run(data, job));
  }

  /** The processor of every consumer queue. */
  async run(data: OutboxDeliveryJobData, job: JobAttemptInfo): Promise<void> {
    const businessId = toBusinessId(data.businessId);
    const eventKey: OutboxEventKey = { id: data.outboxId, createdAt: new Date(data.createdAt) };
    const key: OutboxDeliveryKey = { createdAt: eventKey.createdAt, outboxId: data.outboxId, consumer: data.consumer };
    const consumer = this.registry.get(data.consumer);
    const attempt = await this.beginAttempt(businessId, key);
    if (attempt === null) return;
    try {
      await this.ports.scopes.transactional(businessId, async (scope) => {
        const row = await this.ports.store.lockDelivery(scope, key);
        if (row === null || isTerminalDelivery(row.status)) return;
        const event = await this.ports.store.findEvent(scope, eventKey);
        if (event === null || !isOutboxTopic(event.topic)) {
          throw new OutboxDeliveryMissingError(data.outboxId, data.consumer);
        }
        await consumer.handle(deliveryOf(data, event, attempt), scope);
        const done = { status: 'done', lastError: null } as const;
        await this.ports.store.finishDelivery(scope, key, done, new Date(this.environment.clock.now()));
      });
    } catch (error) {
      await this.fail(error, data, key, job);
    }
  }

  /** Counts the attempt on its own commit; null when the delivery is already over. */
  private beginAttempt(businessId: BusinessId, key: OutboxDeliveryKey): Promise<number | null> {
    return this.ports.scopes.plain(businessId, async (scope) => {
      const row = await this.ports.store.findDelivery(scope, key);
      if (row === null) throw new OutboxDeliveryMissingError(key.outboxId, key.consumer);
      if (isTerminalDelivery(row.status)) return null;
      return this.ports.store.recordAttempt(scope, key, new Date(this.environment.clock.now()));
    });
  }

  private async fail(
    error: unknown,
    data: OutboxDeliveryJobData,
    key: OutboxDeliveryKey,
    job: JobAttemptInfo,
  ): Promise<void> {
    const parked = error instanceof OutboxParkError;
    const last = job.attempts > job.retries;
    if (!parked && !last) throw error;
    const lastError = describeFailure(error);
    await this.ports.scopes.plain(toBusinessId(data.businessId), (scope) =>
      this.ports.store.finishDelivery(
        scope,
        key,
        { status: parked ? 'parked' : 'failed', lastError },
        new Date(this.environment.clock.now()),
      ),
    );
    const code = error instanceof DomainError ? error.code : 'unexpected';
    this.environment.logger.error(
      `Outbox delivery ${data.outboxId}:${data.consumer} of business ${data.businessId} ${parked ? 'parked' : 'failed'} (${code})`,
    );
  }
}
