import { DomainError, toBusinessId } from '@cod/shared';
import { INBOUND_LAST_ERROR_MAX_LENGTH } from '../domain/constants';
import { InboundPayloadGoneError, InboundWebhookMissingError } from '../domain/errors';
import { type InboundJobData, type InboundWebhookRecord, isTerminalInbound } from '../domain/inbound-webhook-handler';
import type { InboundWebhookHandlerRegistry } from './handler-registry';
import type { InboundEnvironment, InboundPorts, InboundWebhookKey, InboundWebhookRow } from './ports';

/** Where a job stands in its retries, as the queue reports it. */
export interface InboundJobAttempt {
  readonly attempts: number;
  readonly retries: number;
}

/**
 * What a row keeps of a failure: the error class and its domain code, cut to the column. Never the message, which can
 * quote the body or a personal value.
 */
export function describeFailure(error: unknown): string {
  const kind = error instanceof Error ? error.constructor.name : typeof error;
  const code = error instanceof DomainError ? error.code : 'unexpected';
  return `${kind} (${code})`.slice(0, INBOUND_LAST_ERROR_MAX_LENGTH);
}

const recordOf = (row: InboundWebhookRow, payload: Buffer): InboundWebhookRecord => ({
  id: row.id,
  receivedAt: row.receivedAt,
  provider: row.provider,
  accountId: row.accountId,
  eventKey: row.eventKey,
  businessId: row.businessId,
  storeId: row.storeId,
  headers: row.headers,
  payload,
});

/**
 * Runs a stored webhook through its provider's handler. The attempt is counted on its own commit, so a failure never
 * loses it; the handler and the `processed` update run in one transaction, so its database effects happen exactly
 * once and a rerun of a finished row does nothing. A failure retries until the last attempt, which ends `failed`.
 */
export class InboundProcessor {
  constructor(
    private readonly ports: InboundPorts,
    private readonly registry: InboundWebhookHandlerRegistry,
    private readonly environment: InboundEnvironment,
  ) {}

  /** The processor of the `inbound-webhooks` queue. */
  async run(data: InboundJobData, job: InboundJobAttempt): Promise<void> {
    const businessId = toBusinessId(data.businessId);
    const key: InboundWebhookKey = { id: data.inboundId, receivedAt: new Date(data.receivedAt) };
    if (!(await this.beginAttempt(data, key))) return;
    try {
      await this.ports.scopes.transactional(businessId, async (scope) => {
        const row = await this.ports.store.lock(scope, key);
        if (row === null || isTerminalInbound(row.status)) return;
        if (row.payload === null) throw new InboundPayloadGoneError(row.id);
        const handler = this.registry.find(row.provider);
        if (handler === undefined) throw new Error(`no handler for provider ${row.provider}`);
        const status = await handler.process(recordOf(row, row.payload), scope);
        await this.ports.store.finish(scope, key, { status, lastError: null }, new Date(this.environment.clock.now()));
      });
    } catch (error) {
      await this.fail(error, data, key, job);
    }
  }

  /** Counts the attempt on its own commit; false when the row is already over. */
  private beginAttempt(data: InboundJobData, key: InboundWebhookKey): Promise<boolean> {
    return this.ports.scopes.plain(toBusinessId(data.businessId), async (scope) => {
      const row = await this.ports.store.find(scope, key);
      if (row === null) throw new InboundWebhookMissingError(key.id);
      if (isTerminalInbound(row.status)) return false;
      return (await this.ports.store.recordAttempt(scope, key, new Date(this.environment.clock.now()))) !== null;
    });
  }

  private async fail(
    error: unknown,
    data: InboundJobData,
    key: InboundWebhookKey,
    job: InboundJobAttempt,
  ): Promise<void> {
    const text = describeFailure(error);
    // The queue stores and logs what is thrown, so a retry gets the same message-free text the row keeps.
    if (job.attempts <= job.retries) throw new Error(text);
    await this.ports.scopes.plain(toBusinessId(data.businessId), (scope) =>
      this.ports.store.finish(
        scope,
        key,
        { status: 'failed', lastError: text },
        new Date(this.environment.clock.now()),
      ),
    );
    this.environment.logger.error(`Inbound webhook ${key.id} of business ${data.businessId} failed: ${text}`);
  }
}
