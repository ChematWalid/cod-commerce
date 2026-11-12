import type { OutboxPayload, OutboxTopic, QueueName, TenantScope } from '@cod/shared';
import type { DeliveryStatus, EventStatus } from './delivery-status';

/** What a caller hands to `OutboxService.add`. The business comes from the scope, never from here. */
export interface OutboxEventInput {
  readonly topic: OutboxTopic;
  readonly payload: OutboxPayload;
  /** The id of the entity the event is about (a snowflake). */
  readonly aggregateId?: string;
  readonly storeId?: string;
  /** Free text a consumer may use to recognise a repeat; the outbox itself does not enforce it. */
  readonly dedupeKey?: string;
}

/** The event `add` wrote. */
export interface OutboxEventRef {
  readonly id: string;
  /** ISO 8601, UTC: with `id` it is the key of the row. */
  readonly createdAt: string;
}

/** The primary key of an event row. */
export interface OutboxEventKey {
  readonly id: string;
  readonly createdAt: Date;
}

/** An event as the relay and the delivery wrapper read it. */
export interface OutboxEventRecord extends OutboxEventKey {
  readonly businessId: string;
  readonly storeId: string | null;
  readonly topic: string;
  readonly aggregateId: string | null;
  readonly payload: OutboxPayload;
  readonly status: EventStatus;
}

/** The primary key of a delivery row. */
export interface OutboxDeliveryKey {
  readonly createdAt: Date;
  readonly outboxId: string;
  readonly consumer: string;
}

/** A delivery row as the wrapper reads it. */
export interface OutboxDeliveryRecord extends OutboxDeliveryKey {
  readonly status: DeliveryStatus;
  readonly attempts: number;
}

/** What a consumer's handler receives. */
export interface OutboxDelivery {
  readonly outboxId: string;
  readonly createdAt: string;
  readonly businessId: string;
  readonly storeId: string | null;
  readonly topic: OutboxTopic;
  readonly aggregateId: string | null;
  readonly payload: OutboxPayload;
  readonly consumer: string;
  /** `{outboxId}:{consumer}`: pass it to every external effect so a repeat is recognised (ADR 0016). */
  readonly idempotencyKey: string;
  /** The number of this run of the delivery, counting from 1. */
  readonly attempt: number;
}

/** A subscriber to outbox topics. Its database effects run in the delivery's transaction and commit exactly once. */
export interface OutboxConsumer {
  /** Kebab-case, at most 40 characters, unique: it is part of the delivery's job id. */
  readonly name: string;
  readonly topics: readonly OutboxTopic[];
  /** The job queue that carries this consumer's deliveries; it names its pool and retries (D101). */
  readonly queue: QueueName;
  /**
   * Handles one delivery. `scope` is the delivery's business and carries the transaction: use it for every tenant
   * repository call. Throw {@link OutboxParkError} to park the delivery, anything else to retry it.
   */
  handle(delivery: OutboxDelivery, scope: TenantScope): Promise<void>;
}

/** The data of an `outbox-relay` job (D104). */
export interface OutboxRelayJobData {
  readonly jobId: string;
  readonly outboxId: string;
  readonly createdAt: string;
  readonly businessId: string;
}

/** The data of a delivery job on a consumer's queue. */
export interface OutboxDeliveryJobData extends OutboxRelayJobData {
  readonly consumer: string;
}
