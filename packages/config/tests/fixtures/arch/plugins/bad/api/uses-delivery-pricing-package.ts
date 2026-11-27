import { deliveryPricingEntry } from '@cod/plugin-delivery-pricing';

/** Forbidden: api/ goes through its own application ports, never the delivery-pricing entry (D3118). */
export const deliveryPricingInApi = deliveryPricingEntry;
