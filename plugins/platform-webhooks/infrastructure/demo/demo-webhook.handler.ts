import { createHmac, timingSafeEqual } from 'node:crypto';
import { OutboxService } from '@cod/plugin-platform-outbox';
import { SecretNotFoundError, SecretUnreadableError, TenantSecretService } from '@cod/plugin-platform-secrets';
import { PlatformStoreLookup } from '@cod/plugin-tenancy';
import { type TenantScope, toBusinessId } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { InboundScopesPort } from '../../application/ports';
import { INBOUND_SCOPES } from '../../application/tokens';
import {
  DEMO_EVENT_HEADER,
  DEMO_PROVIDER,
  DEMO_SECRET_PROVIDER,
  DEMO_SECRET_REF,
  DEMO_SIGNATURE_HEADER,
  DEMO_TOPIC,
} from '../../domain/constants';
import type {
  InboundWebhookHandler,
  InboundWebhookRecord,
  WebhookAccount,
  WebhookRequest,
} from '../../domain/inbound-webhook-handler';

/** The signature the demo provider sends for `rawBody`: `sha256=` and the hex HMAC-SHA-256 under `secret` (D110). */
export function demoSignature(secret: string, rawBody: Buffer): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

const sameText = (given: string, wanted: string): boolean => {
  const left = Buffer.from(given);
  const right = Buffer.from(wanted);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * The demo provider (D110) for development, tests and evidence. The account key is an active store's subdomain; the
 * signing secret is the business's own `demo-webhook`/`signing` secret, so one business's key never verifies another's.
 * Processing writes an outbox event on `platform.demo`. It is registered only when `PLATFORM_DEMO_HANDLERS` is on.
 */
@Injectable()
export class DemoWebhookHandler implements InboundWebhookHandler {
  readonly provider = DEMO_PROVIDER;
  readonly persistedHeaders = [DEMO_EVENT_HEADER];

  constructor(
    @Inject(PlatformStoreLookup) private readonly stores: PlatformStoreLookup,
    @Inject(TenantSecretService) private readonly secrets: TenantSecretService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(INBOUND_SCOPES) private readonly scopes: InboundScopesPort,
  ) {}

  async resolveAccount(accountKey: string): Promise<WebhookAccount | null> {
    const store = await this.stores.findBySubdomain(accountKey);
    if (store === null) return null;
    return { accountId: store.storeId, businessId: toBusinessId(store.businessId), storeId: store.storeId };
  }

  async verify(account: WebhookAccount, request: WebhookRequest): Promise<boolean> {
    const secret = await this.signingSecret(account);
    if (secret === undefined) return false;
    return sameText(request.headers[DEMO_SIGNATURE_HEADER] ?? '', demoSignature(secret, request.rawBody));
  }

  eventKey(_account: WebhookAccount, request: WebhookRequest): string | null {
    return request.headers[DEMO_EVENT_HEADER] ?? null;
  }

  async process(record: InboundWebhookRecord, scope: TenantScope): Promise<'processed'> {
    await this.outbox.add(scope, {
      topic: DEMO_TOPIC,
      payload: { inboundId: record.id, eventKey: record.eventKey },
      ...(record.storeId === null ? {} : { storeId: record.storeId }),
    });
    return 'processed';
  }

  /** The business's signing secret, or undefined when it has none or it cannot be opened: both fail verification. */
  private async signingSecret(account: WebhookAccount): Promise<string | undefined> {
    try {
      return await this.scopes.plain(account.businessId, (scope) =>
        this.secrets.reveal(scope, DEMO_SECRET_PROVIDER, DEMO_SECRET_REF),
      );
    } catch (error) {
      if (error instanceof SecretNotFoundError || error instanceof SecretUnreadableError) return undefined;
      throw error;
    }
  }
}
