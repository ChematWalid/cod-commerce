import { DURABLE_JOB_KINDS, durableJobId } from '@cod/shared';
import { INBOUND_WEBHOOKS_FLAG, CONTENT_TYPE_MAX_LENGTH } from '../domain/constants';
import { defaultEventKey, normalizeEventKey } from '../domain/event-key';
import type { GatewayOutcome } from '../domain/gateway-outcome';
import type { InboundWebhookHandler, WebhookAccount, WebhookRequest } from '../domain/inbound-webhook-handler';
import type { InboundWebhookHandlerRegistry } from './handler-registry';
import type { InboundEnvironment, InboundPorts, KillSwitchPort } from './ports';

/** Longest provider name logged: the `provider` column length. */
const PROVIDER_LOG_MAX = 40;

/** What the gateway is built from. */
export interface WebhookGatewayDeps {
  readonly ports: InboundPorts;
  readonly registry: InboundWebhookHandlerRegistry;
  readonly killSwitch: KillSwitchPort;
  readonly environment: InboundEnvironment;
}

const pickHeaders = (all: Readonly<Record<string, string>>, names: readonly string[]): Record<string, string> => {
  const kept: Record<string, string> = {};
  for (const name of names) {
    const value = all[name];
    if (value !== undefined) kept[name] = value;
  }
  return kept;
};

/**
 * The inbound side of every provider (D109). In order: kill switch, provider, account, signature; then one
 * transaction writes the dedupe key and, for a new event, the stored webhook; the job is queued after commit. A
 * duplicate answers like a new event, so a provider's retry never learns which it was. Nothing here logs a body.
 */
export class WebhookGatewayService {
  constructor(private readonly deps: WebhookGatewayDeps) {}

  /** Handles one request as of `now` (the time the webhook is stored under). */
  async receive(provider: string, accountKey: string, request: WebhookRequest, now: Date): Promise<GatewayOutcome> {
    if (!(await this.enabled())) return 'disabled';
    const handler = this.deps.registry.find(provider);
    if (handler === undefined) return this.refuse('unknown-provider', provider);
    const account = await handler.resolveAccount(accountKey);
    if (account === null) return this.refuse('unknown-account', provider);
    if (!(await handler.verify(account, request))) return this.refuse('bad-signature', provider, account.accountId);
    return this.store(handler, account, request, now);
  }

  private async enabled(): Promise<boolean> {
    try {
      return await this.deps.killSwitch.isEnabled(INBOUND_WEBHOOKS_FLAG);
    } catch (error: unknown) {
      // A flag store outage must not stop webhooks: the switch is for an operator's decision, not for failures.
      this.deps.environment.logger.error(
        `Kill switch ${INBOUND_WEBHOOKS_FLAG} unreadable, treated as on: ${error instanceof Error ? error.name : typeof error}`,
      );
      return true;
    }
  }

  private refuse(outcome: GatewayOutcome, provider: string, accountId?: string): GatewayOutcome {
    const who = accountId === undefined ? '' : ` account=${accountId}`;
    // The provider is a caller-supplied path segment on an unauthenticated route: cap it and escape control characters.
    const shown = JSON.stringify(provider.slice(0, PROVIDER_LOG_MAX));
    this.deps.environment.logger.warn(`Inbound webhook refused: provider=${shown}${who} outcome=${outcome}`);
    return outcome;
  }

  private async store(
    handler: InboundWebhookHandler,
    account: WebhookAccount,
    request: WebhookRequest,
    now: Date,
  ): Promise<GatewayOutcome> {
    const { ports, environment } = this.deps;
    const eventKey =
      normalizeEventKey(handler.eventKey(account, request)) ??
      defaultEventKey(handler.provider, account.accountId, request.rawBody);
    const id = environment.ids.next();
    const base = { provider: handler.provider, accountId: account.accountId, eventKey, receivedAt: now };
    const inserted = await ports.scopes.transactional(account.businessId, async (scope) => {
      if (!(await ports.store.insertKey(scope, base))) return false;
      await ports.store.insertWebhook(scope, {
        ...base,
        id,
        storeId: account.storeId ?? null,
        contentType: request.contentType.slice(0, CONTENT_TYPE_MAX_LENGTH),
        headers: pickHeaders(request.headers, handler.persistedHeaders),
        payload: request.rawBody,
      });
      return true;
    });
    if (!inserted) return 'duplicate';
    await this.enqueue(id, now, account);
    return 'accepted';
  }

  /** After commit. A failure leaves the durable row to the reconciler, so the provider still gets its 200. */
  private async enqueue(id: string, receivedAt: Date, account: WebhookAccount): Promise<void> {
    try {
      await this.deps.ports.queue.enqueue({
        jobId: durableJobId(DURABLE_JOB_KINDS.inboundWebhook, id),
        inboundId: id,
        receivedAt: receivedAt.toISOString(),
        businessId: account.businessId,
      });
    } catch (error: unknown) {
      this.deps.environment.logger.error(
        `Inbound webhook ${id} stored but not queued, the reconciler will queue it: ${error instanceof Error ? error.name : typeof error}`,
      );
    }
  }
}
