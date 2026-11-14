/**
 * Names of the domain events plugins exchange, formatted `aggregate.event-name`.
 *
 * @remarks Stub — owner: the session that first publishes each event adds it here.
 */
export const DOMAIN_EVENT_NAMES = {
  OrderPlaced: 'order.placed',
  ParcelStatusChanged: 'parcel.status-changed',
  OrderDelivered: 'order.delivered',
  OrderReturned: 'order.returned',
  ReturnProcessed: 'return.processed',
  DeviceTrusted: 'device.trusted',
  SalaryPaid: 'salary.paid',
  ProductChanged: 'product.changed',
} as const;

/** One of the {@link DOMAIN_EVENT_NAMES} values. */
export type DomainEventName = (typeof DOMAIN_EVENT_NAMES)[keyof typeof DOMAIN_EVENT_NAMES];
