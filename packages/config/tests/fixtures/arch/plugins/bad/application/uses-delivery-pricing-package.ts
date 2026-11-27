import { deliveryPricingEntry } from '@cod/plugin-delivery-pricing';

/** Forbidden: application/ declares ports, it never imports the delivery-pricing entry (D3118). */
export const deliveryPricingInApplication = deliveryPricingEntry;
