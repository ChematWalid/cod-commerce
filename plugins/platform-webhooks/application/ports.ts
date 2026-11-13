import type { BusinessId, TenantScope } from '@cod/shared';
import type { InboundJobData, InboundStatus } from '../domain/inbound-webhook-handler';

/** Whether an operational flag is on; the adapter reads the operational flags (D116). */
export interface KillSwitchPort {
  isEnabled(flagKey: string): Promise<boolean>;
}

/** Runs work for one business, with or without a transaction. The scope carries whichever it opened. */
export interface InboundScopesPort {
  /** One transaction: it commits when `work` returns and rolls back when it throws. */
  transactional<T>(businessId: BusinessId, work: (scope: TenantScope) => Promise<T>): Promise<T>;
  /** No transaction: each store call commits on its own. */
  plain<T>(businessId: BusinessId, work: (scope: TenantScope) => Promise<T>): Promise<T>;
}

/** The dedupe row of a webhook (platform table, `ON CONFLICT DO NOTHING`). */
export interface NewInboundKey {
  readonly provider: string;
  readonly accountId: string;
  readonly eventKey: string;
  readonly receivedAt: Date;
}

/** The stored webhook the gateway inserts. */
export interface NewInboundWebhook extends NewInboundKey {
  readonly id: string;
  readonly storeId: string | null;
  readonly contentType: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: Buffer;
}

/** The primary key of a stored webhook. */
export interface InboundWebhookKey {
  readonly id: string;
  readonly receivedAt: Date;
}

/** A stored webhook as the processor reads it. */
export interface InboundWebhookRow extends InboundWebhookKey {
  readonly businessId: BusinessId;
  readonly storeId: string | null;
  readonly provider: string;
  readonly accountId: string;
  readonly eventKey: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Null once the retention scrub cleared it. */
  readonly payload: Buffer | null;
  readonly status: InboundStatus;
  readonly attempts: number;
}

/** The gateway's tables. Adapters are the only code that touches TypeORM. */
export interface InboundStorePort {
  /** Inserts the dedupe row; false when the triple already exists. Needs a transaction. */
  insertKey(scope: TenantScope, key: NewInboundKey): Promise<boolean>;
  insertWebhook(scope: TenantScope, row: NewInboundWebhook): Promise<void>;
  find(scope: TenantScope, key: InboundWebhookKey): Promise<InboundWebhookRow | null>;
  /** Reads the row and locks it until the transaction ends. Needs a transaction. */
  lock(scope: TenantScope, key: InboundWebhookKey): Promise<InboundWebhookRow | null>;
  /** Adds one to `attempts` of a `received` row and returns the new count, or null when the row is over. */
  recordAttempt(scope: TenantScope, key: InboundWebhookKey, at: Date): Promise<number | null>;
  /** Ends a `received` row. `lastError` is already truncated and free of the body. */
  finish(
    scope: TenantScope,
    key: InboundWebhookKey,
    outcome: { readonly status: Exclude<InboundStatus, 'received'>; readonly lastError: string | null },
    at: Date,
  ): Promise<void>;
  /** The row's job was added again: moves `updatedAt` to `at`. */
  markReenqueued(scope: TenantScope, key: InboundWebhookKey, at: Date): Promise<void>;
}

/** The `inbound-webhooks` queue. */
export interface InboundQueuePort {
  enqueue(data: InboundJobData): Promise<void>;
}

/** A received row as the reconciler sees it: a key and its business, nothing of the payload. */
export interface DueInboundRow {
  readonly id: string;
  readonly receivedAt: Date;
  readonly businessId: string;
  readonly attempts: number;
  readonly stuckSince: Date;
}

/** The platform's view across businesses of the received rows that are still open. */
export interface InboundDueScanPort {
  /** `received` rows last touched at or before `touchedBefore`, oldest first; with `after`, those that sort after it. */
  dueWebhooks(
    since: Date,
    touchedBefore: Date,
    limit: number,
    after?: DueInboundRow,
  ): Promise<readonly DueInboundRow[]>;
}

/** Deletes expired dedupe keys (platform table). */
export interface KeyPurgePort {
  /** Deletes up to `limit` keys received before `cutoff` and returns how many went. */
  deleteKeysBefore(cutoff: Date, limit: number): Promise<number>;
}

/** Where the gateway says what needs a person's eye. */
export interface InboundLogger {
  error(message: string): void;
  warn(message: string): void;
}

/** Time, so tests can set it. */
export interface InboundClock {
  now(): number;
}

/** Makes the ids of stored webhooks (snowflakes). */
export interface InboundIdSource {
  next(): string;
}

/** What the services need of their surroundings. */
export interface InboundEnvironment {
  readonly logger: InboundLogger;
  readonly clock: InboundClock;
  readonly ids: InboundIdSource;
}

/** The adapters the gateway, the processor and the reconciler source work through. */
export interface InboundPorts {
  readonly store: InboundStorePort;
  readonly scopes: InboundScopesPort;
  readonly queue: InboundQueuePort;
}
