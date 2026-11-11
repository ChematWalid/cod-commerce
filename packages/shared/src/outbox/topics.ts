/** The topics an outbox event may carry (ADR 0016 section 1). A new topic is a new entry here, never a free string. */
export const OUTBOX_TOPICS = [
  'order.placed',
  'order.confirmed',
  'order.delivered',
  'order.returned',
  'parcel.status_changed',
  'product.changed',
  'platform.demo',
] as const;

/** One of {@link OUTBOX_TOPICS}. */
export type OutboxTopic = (typeof OUTBOX_TOPICS)[number];

/** True when `value` is a topic of the registry. */
export function isOutboxTopic(value: string): value is OutboxTopic {
  return (OUTBOX_TOPICS as readonly string[]).includes(value);
}
