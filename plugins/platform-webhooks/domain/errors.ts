import { DomainError } from '@cod/shared';

/** A handler registered after bootstrap; handlers belong in `onModuleInit` so every process knows them. */
export class HandlerRegistryClosedError extends DomainError {
  readonly code = 'webhooks.registry-closed';

  constructor(provider: string) {
    super(`Webhook handler "${provider}" was registered after bootstrap; register handlers in onModuleInit`);
  }
}

/** A provider name used twice, or one the URL cannot carry. */
export class HandlerInvalidError extends DomainError {
  readonly code = 'webhooks.handler-invalid';

  constructor(provider: string, reason: string) {
    super(`Webhook handler "${provider}" cannot be registered: ${reason}`);
  }
}

/** A stored webhook a job names is not in the table. */
export class InboundWebhookMissingError extends DomainError {
  readonly code = 'webhooks.inbound-missing';

  constructor(inboundId: string) {
    super(`Inbound webhook ${inboundId} was not found`);
  }
}

/** A stored webhook whose payload was cleared before it was processed. */
export class InboundPayloadGoneError extends DomainError {
  readonly code = 'webhooks.payload-gone';

  constructor(inboundId: string) {
    super(`Inbound webhook ${inboundId} has no payload left to process`);
  }
}
