import type { BusinessId, TenantScope } from '@cod/shared';

/** The business (and optionally store) a provider account belongs to. */
export interface WebhookAccount {
  readonly accountId: string;
  readonly businessId: BusinessId;
  readonly storeId?: string;
}

/** What the gateway read off the request: lower-case headers and the exact body bytes (after decompression). */
export interface WebhookRequest {
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: Buffer;
  readonly contentType: string;
}

/** A stored webhook, as `process` receives it. */
export interface InboundWebhookRecord {
  readonly id: string;
  readonly receivedAt: Date;
  readonly provider: string;
  readonly accountId: string;
  readonly eventKey: string;
  readonly businessId: BusinessId;
  readonly storeId: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: Buffer;
}

/**
 * One provider's side of the gateway. A feature plugin implements it and registers it with
 * `InboundWebhookHandlerRegistry.register` in `onModuleInit` (D109, extension by registry).
 */
export interface InboundWebhookHandler {
  readonly provider: string;
  /** The request headers kept with the stored webhook; every other header is dropped. Lower-case. */
  readonly persistedHeaders: readonly string[];
  /** The account behind the key in the URL, or null when there is none. */
  resolveAccount(accountKey: string): Promise<WebhookAccount | null>;
  /** True when the request's signature is valid for the account. Never throws for a bad signature. */
  verify(account: WebhookAccount, request: WebhookRequest): Promise<boolean>;
  /** The provider's own event id, or null to key the event on the raw body. */
  eventKey(account: WebhookAccount, request: WebhookRequest): string | null;
  /**
   * Handles the stored webhook. `scope` is the account's business and carries the transaction the row's `processed`
   * update commits in, so database effects happen exactly once. Throw to retry.
   */
  process(record: InboundWebhookRecord, scope: TenantScope): Promise<'processed' | 'ignored'>;
}

/** Where a stored webhook stands. */
export const INBOUND_STATUSES = ['received', 'processed', 'ignored', 'failed'] as const;
export type InboundStatus = (typeof INBOUND_STATUSES)[number];

/** True for a status nothing more happens after. */
export const isTerminalInbound = (status: InboundStatus): boolean => status !== 'received';

/** The data of an `inbound-webhooks` job (D102). */
export interface InboundJobData {
  readonly jobId: string;
  readonly inboundId: string;
  readonly receivedAt: string;
  readonly businessId: string;
}
