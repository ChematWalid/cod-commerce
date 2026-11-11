import type { BusinessId, OutboxPayload, QueueName, TenantScope } from '@cod/shared';
import type { DeliveryStatus } from '../domain/delivery-status';
import type {
  OutboxDeliveryJobData,
  OutboxDeliveryKey,
  OutboxDeliveryRecord,
  OutboxEventKey,
  OutboxEventRecord,
  OutboxRelayJobData,
} from '../domain/outbox-event';

/** Where a job stands in its retries, as the queue reports it. */
export interface JobAttemptInfo {
  readonly attempts: number;
  readonly retries: number;
}

/** A row `add` inserts. */
export interface NewOutboxEvent extends OutboxEventKey {
  readonly storeId: string | null;
  readonly topic: string;
  readonly aggregateId: string | null;
  readonly payload: OutboxPayload;
  readonly dedupeKey: string | null;
}

/** A delivery the relay inserts. */
export interface NewOutboxDelivery extends OutboxDeliveryKey {
  readonly at: Date;
}

/** The outbox tables, always under a tenant scope (ADR 0002). Adapters are the only code that touches TypeORM. */
export interface OutboxStorePort {
  /** @throws OutboxTransactionRequiredError when the scope carries no active transaction. */
  insertEvent(scope: TenantScope, row: NewOutboxEvent): Promise<void>;
  /** Reads the event and locks its row until the transaction ends. Needs a transaction. */
  lockEvent(scope: TenantScope, key: OutboxEventKey): Promise<OutboxEventRecord | null>;
  findEvent(scope: TenantScope, key: OutboxEventKey): Promise<OutboxEventRecord | null>;
  markRelayed(scope: TenantScope, key: OutboxEventKey, at: Date): Promise<void>;
  insertDeliveries(scope: TenantScope, rows: readonly NewOutboxDelivery[]): Promise<void>;
  /** The consumers of the event whose delivery is still `pending`. */
  pendingConsumers(scope: TenantScope, key: OutboxEventKey): Promise<string[]>;
  /** Marks a `pending` delivery `enqueued`; one in any other status is left alone. */
  markEnqueued(scope: TenantScope, key: OutboxDeliveryKey, at: Date): Promise<void>;
  findDelivery(scope: TenantScope, key: OutboxDeliveryKey): Promise<OutboxDeliveryRecord | null>;
  /** Reads the delivery and locks its row until the transaction ends. Needs a transaction. */
  lockDelivery(scope: TenantScope, key: OutboxDeliveryKey): Promise<OutboxDeliveryRecord | null>;
  /** Adds one to `attempts` of a delivery that is not terminal and returns the new count, or null when it is. */
  recordAttempt(scope: TenantScope, key: OutboxDeliveryKey, at: Date): Promise<number | null>;
  /** Ends a delivery that is not terminal. `lastError` is already truncated and free of the payload. */
  finishDelivery(
    scope: TenantScope,
    key: OutboxDeliveryKey,
    outcome: {
      readonly status: Extract<DeliveryStatus, 'done' | 'failed' | 'parked'>;
      readonly lastError: string | null;
    },
    at: Date,
  ): Promise<void>;
}

/** Runs work for one business, with or without a transaction. The scope carries whichever it opened. */
export interface OutboxScopesPort {
  /** One transaction: it commits when `work` returns and rolls back when it throws. */
  transactional<T>(businessId: BusinessId, work: (scope: TenantScope) => Promise<T>): Promise<T>;
  /** No transaction: each store call commits on its own. */
  plain<T>(businessId: BusinessId, work: (scope: TenantScope) => Promise<T>): Promise<T>;
}

/** Announces committed work to the relay; the adapter delivers the announcement only after commit. */
export interface OutboxAnnouncerPort {
  announce(scope: TenantScope, events: readonly { id: string; createdAt: string }[]): Promise<void>;
}

/** The job queues of the outbox. */
export interface OutboxQueuesPort {
  enqueueRelay(data: OutboxRelayJobData): Promise<void>;
  enqueueDelivery(queue: QueueName, data: OutboxDeliveryJobData): Promise<void>;
  /** Creates `queue` with one processor. Only during `onModuleInit`. */
  defineDeliveryQueue(
    queue: QueueName,
    process: (data: OutboxDeliveryJobData, job: JobAttemptInfo) => Promise<void>,
  ): void;
}

/** Where the outbox says what needs a person's eye. */
export interface OutboxLogger {
  error(message: string): void;
  warn(message: string): void;
}

/** Makes the ids of new events (snowflakes). */
export interface OutboxIdSource {
  next(): string;
}

/** Time, so tests can set it. */
export interface OutboxClock {
  now(): number;
}

/** The adapters the relay and the delivery wrapper work through. */
export interface OutboxPorts {
  readonly store: OutboxStorePort;
  readonly scopes: OutboxScopesPort;
  readonly queues: OutboxQueuesPort;
}

/** What those services need of their surroundings. */
export interface OutboxEnvironment {
  readonly logger: OutboxLogger;
  readonly clock: OutboxClock;
}
