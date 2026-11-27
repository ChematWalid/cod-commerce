import type { PermissionKey } from '@cod/shared';

/** The catalogue keys the fee-group handlers require: the `delivery.pricing.*` keys, one per action. */
export const DELIVERY_PRICING_PERMISSIONS = {
  view: 'delivery.pricing.view',
  create: 'delivery.pricing.create',
  edit: 'delivery.pricing.edit',
  delete: 'delivery.pricing.delete',
} as const satisfies Record<string, PermissionKey>;
