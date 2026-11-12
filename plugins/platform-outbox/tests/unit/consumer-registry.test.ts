import { describe, expect, it } from 'vitest';
import { OutboxConsumerRegistry } from '../../application/consumer-registry';
import type { OutboxQueuesPort } from '../../application/ports';
import type { OutboxConsumer } from '../../domain/outbox-event';

const consumer = (overrides: Partial<OutboxConsumer> = {}): OutboxConsumer => ({
  name: 'demo-log',
  topics: ['platform.demo'],
  queue: 'order-effects',
  handle: () => Promise.resolve(),
  ...overrides,
});

const fakeQueues = (): OutboxQueuesPort & { defined: string[] } => {
  const defined: string[] = [];
  return {
    defined,
    enqueueRelay: () => Promise.resolve(),
    enqueueDelivery: () => Promise.resolve(),
    defineDeliveryQueue: (queue) => {
      defined.push(queue);
    },
  };
};

describe('OutboxConsumerRegistry', () => {
  it('defines a queue once for any number of consumers on it', () => {
    // Arrange
    const queues = fakeQueues();
    const registry = new OutboxConsumerRegistry(queues);

    // Act
    registry.register(consumer());
    registry.register(consumer({ name: 'other-log' }));
    registry.register(consumer({ name: 'bulk-log', queue: 'analytics' }));

    // Assert
    expect(queues.defined).toEqual(['order-effects', 'analytics']);
  });

  it('finds the consumers of a topic and a consumer by name', () => {
    // Arrange
    const registry = new OutboxConsumerRegistry(fakeQueues());
    registry.register(consumer());
    registry.register(consumer({ name: 'orders', topics: ['order.placed'] }));

    // Assert
    expect(registry.forTopic('platform.demo').map((found) => found.name)).toEqual(['demo-log']);
    expect(registry.get('orders').name).toBe('orders');
    expect(() => {
      registry.get('nobody');
    }).toThrow(expect.objectContaining({ code: 'outbox.consumer-unknown' }));
  });

  it.each([
    ['not kebab-case', { name: 'Demo_Log' }],
    ['longer than 40 characters', { name: 'a'.repeat(41) }],
    ['listening to no topic', { topics: [] }],
  ])('refuses a consumer that is %s', (_label, overrides) => {
    // Arrange
    const registry = new OutboxConsumerRegistry(fakeQueues());

    // Assert
    expect(() => {
      registry.register(consumer(overrides));
    }).toThrow(expect.objectContaining({ code: 'outbox.consumer-invalid' }));
  });

  it('refuses a repeated name and any registration after close', () => {
    // Arrange
    const registry = new OutboxConsumerRegistry(fakeQueues());
    registry.register(consumer());

    // Assert
    expect(() => {
      registry.register(consumer());
    }).toThrow(expect.objectContaining({ code: 'outbox.consumer-invalid' }));
    registry.close();
    expect(() => {
      registry.register(consumer({ name: 'late' }));
    }).toThrow(expect.objectContaining({ code: 'outbox.registry-closed' }));
  });
});
