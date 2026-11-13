import { createHmac, timingSafeEqual } from 'node:crypto';
import { OutboxService, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { Inject } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { InboundWebhookHandlerRegistry } from '../../application/handler-registry';
import type {
  InboundWebhookHandler,
  InboundWebhookRecord,
  WebhookAccount,
  WebhookRequest,
} from '../../domain/inbound-webhook-handler';
import { PlatformWebhooksPlugin } from '../../platform-webhooks.plugin';

/** The signing secret of the fixture provider: a synthetic value, shared by every fixture account. */
export const TEST_SIGNING_SECRET = 'synthetic-test-signing-secret';

/** The header that carries the signature. */
export const TEST_SIGNATURE_HEADER = 'x-test-signature';

/** The header the provider puts its own event id in. */
export const TEST_EVENT_HEADER = 'x-test-event-id';

/** Accounts of the fixture provider by account key; a test fills it once it knows the businesses. */
export const testAccounts = new Map<string, WebhookAccount>();

/** How often `process` ran per inbound id, and how it should behave. */
export const processing = {
  calls: new Map<string, number>(),
  failuresLeft: 0,
  reset(): void {
    this.calls.clear();
    this.failuresLeft = 0;
  },
  total(): number {
    return [...this.calls.values()].reduce((sum, count) => sum + count, 0);
  },
};

/** The signature a provider would send for `rawBody`. */
export function signTestBody(rawBody: Buffer | string): string {
  return `sha256=${createHmac('sha256', TEST_SIGNING_SECRET).update(rawBody).digest('hex')}`;
}

const testHandler = (outbox: OutboxService): InboundWebhookHandler => ({
  provider: 'test',
  persistedHeaders: [TEST_EVENT_HEADER],
  resolveAccount: (accountKey: string): Promise<WebhookAccount | null> =>
    Promise.resolve(testAccounts.get(accountKey) ?? null),
  verify: (_account: WebhookAccount, request: WebhookRequest): Promise<boolean> => {
    const given = Buffer.from(request.headers[TEST_SIGNATURE_HEADER] ?? '');
    const wanted = Buffer.from(signTestBody(request.rawBody));
    return Promise.resolve(given.length === wanted.length && timingSafeEqual(given, wanted));
  },
  eventKey: (_account: WebhookAccount, request: WebhookRequest): string | null =>
    request.headers[TEST_EVENT_HEADER] ?? null,
  async process(record: InboundWebhookRecord, scope): Promise<'processed' | 'ignored'> {
    processing.calls.set(record.id, (processing.calls.get(record.id) ?? 0) + 1);
    if (processing.failuresLeft > 0) {
      processing.failuresLeft -= 1;
      throw new Error('flaky provider handler');
    }
    if (record.payload.toString('utf8').includes('ignore-me')) return 'ignored';
    await outbox.add(scope as never, {
      topic: 'platform.demo',
      payload: { inboundId: record.id, provider: record.provider },
    });
    return 'processed';
  },
});

/** Registers the fixture provider `test`, whose process writes an outbox event and counts its calls. */
@VendurePlugin({ imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin, PlatformWebhooksPlugin] })
export class TestHandlerPlugin {
  constructor(
    @Inject(InboundWebhookHandlerRegistry) private readonly registry: InboundWebhookHandlerRegistry,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    this.registry.register(testHandler(this.outbox));
  }
}
