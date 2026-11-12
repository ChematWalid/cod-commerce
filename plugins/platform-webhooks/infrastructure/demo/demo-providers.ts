import { OutboxConsumerRegistry } from '@cod/plugin-platform-outbox';
import { TenantSecretProviderRegistry } from '@cod/plugin-platform-secrets';
import { Inject, Injectable } from '@nestjs/common';
import { InboundWebhookHandlerRegistry } from '../../application/handler-registry';
import { DEMO_SECRET_PROVIDER } from '../../domain/constants';
import { demoLogConsumer } from './demo-log.consumer';
import { DemoWebhookHandler } from './demo-webhook.handler';

/** The ref of the demo secret: only `signing`. */
const DEMO_REF_PATTERN = /^signing$/;

/**
 * Registers the demo provider `demo` with the gateway, `demo-webhook` with the secrets store and `demo-log` with the
 * outbox (D110). The plugin calls it from `onModuleInit` only when `demoHandlers` is on.
 */
@Injectable()
export class DemoProviders {
  constructor(
    @Inject(InboundWebhookHandlerRegistry) private readonly handlers: InboundWebhookHandlerRegistry,
    @Inject(TenantSecretProviderRegistry) private readonly secrets: TenantSecretProviderRegistry,
    @Inject(OutboxConsumerRegistry) private readonly consumers: OutboxConsumerRegistry,
    @Inject(DemoWebhookHandler) private readonly handler: DemoWebhookHandler,
  ) {}

  register(): void {
    this.secrets.register({ provider: DEMO_SECRET_PROVIDER, refPattern: DEMO_REF_PATTERN });
    this.consumers.register(demoLogConsumer);
    this.handlers.register(this.handler);
  }
}
