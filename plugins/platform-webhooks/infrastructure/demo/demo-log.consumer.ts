import type { OutboxConsumer, OutboxDelivery } from '@cod/plugin-platform-outbox';
import { Logger } from '@vendure/core';
import { DEMO_CONSUMER, DEMO_QUEUE, DEMO_TOPIC, WEBHOOKS_LOG_CONTEXT } from '../../domain/constants';

/** The demo consumer (D110): logs that the event arrived, naming ids only, never the payload. */
export const demoLogConsumer: OutboxConsumer = {
  name: DEMO_CONSUMER,
  topics: [DEMO_TOPIC],
  queue: DEMO_QUEUE,
  handle(delivery: OutboxDelivery): Promise<void> {
    Logger.info(
      `${DEMO_CONSUMER}: event ${delivery.outboxId} of business ${delivery.businessId} (attempt ${String(delivery.attempt)})`,
      WEBHOOKS_LOG_CONTEXT,
    );
    return Promise.resolve();
  },
};
