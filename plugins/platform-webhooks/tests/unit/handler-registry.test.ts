import { describe, expect, it } from 'vitest';
import { InboundWebhookHandlerRegistry } from '../../application/handler-registry';
import { HandlerInvalidError, HandlerRegistryClosedError } from '../../domain/errors';
import type { InboundWebhookHandler } from '../../domain/inbound-webhook-handler';

const handler = (provider: string): InboundWebhookHandler => ({
  provider,
  persistedHeaders: [],
  resolveAccount: () => Promise.resolve(null),
  verify: () => Promise.resolve(false),
  eventKey: () => null,
  process: () => Promise.resolve('ignored'),
});

describe('InboundWebhookHandlerRegistry', () => {
  it('finds a registered provider and answers undefined for another', () => {
    // Arrange
    const registry = new InboundWebhookHandlerRegistry();
    const acme = handler('acme');

    // Act
    registry.register(acme);

    // Assert
    expect(registry.find('acme')).toBe(acme);
    expect(registry.find('other')).toBeUndefined();
  });

  it('refuses a duplicate provider and a name the URL cannot carry', () => {
    // Arrange
    const registry = new InboundWebhookHandlerRegistry();
    registry.register(handler('acme'));

    // Act and assert
    expect(() => {
      registry.register(handler('acme'));
    }).toThrow(HandlerInvalidError);
    expect(() => {
      registry.register(handler('Bad/Name'));
    }).toThrow(HandlerInvalidError);
  });

  it('refuses a provider registered after the registry closed', () => {
    // Arrange
    const registry = new InboundWebhookHandlerRegistry();
    registry.close();

    // Act and assert
    expect(() => {
      registry.register(handler('late'));
    }).toThrow(HandlerRegistryClosedError);
  });
});
