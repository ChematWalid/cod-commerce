import { HandlerInvalidError, HandlerRegistryClosedError } from '../domain/errors';
import type { InboundWebhookHandler } from '../domain/inbound-webhook-handler';

/** A provider name is the URL segment: lower-case words and digits joined by single dashes. */
const PROVIDER_FORMAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PROVIDER_MAX_LENGTH = 40;

/** The provider adapters of the gateway (D109): a registry, never a switch. Closes at bootstrap. */
export class InboundWebhookHandlerRegistry {
  private readonly handlers = new Map<string, InboundWebhookHandler>();
  private closed = false;

  /** Adds a provider. Only during `onModuleInit`. */
  register(handler: InboundWebhookHandler): void {
    if (this.closed) throw new HandlerRegistryClosedError(handler.provider);
    if (!PROVIDER_FORMAT.test(handler.provider) || handler.provider.length > PROVIDER_MAX_LENGTH) {
      throw new HandlerInvalidError(handler.provider, 'the name must be kebab-case, at most 40 characters');
    }
    if (this.handlers.has(handler.provider)) throw new HandlerInvalidError(handler.provider, 'already registered');
    this.handlers.set(handler.provider, handler);
  }

  /** The provider's handler, or undefined for an unknown name. */
  find(provider: string): InboundWebhookHandler | undefined {
    return this.handlers.get(provider);
  }

  /** Called once every `onModuleInit` has run. */
  close(): void {
    this.closed = true;
  }
}
