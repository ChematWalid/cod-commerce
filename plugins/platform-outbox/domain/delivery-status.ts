/** Where an event stands: written, or routed to its consumers (D104). */
export const EVENT_STATUSES = ['pending', 'relayed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Where one consumer's delivery stands (D105). */
export const DELIVERY_STATUSES = ['pending', 'enqueued', 'done', 'failed', 'parked'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The statuses a delivery never leaves. */
export const TERMINAL_DELIVERY_STATUSES: readonly DeliveryStatus[] = ['done', 'failed', 'parked'];

/** True for a delivery nothing more will happen to. */
export function isTerminalDelivery(status: DeliveryStatus): boolean {
  return TERMINAL_DELIVERY_STATUSES.includes(status);
}
