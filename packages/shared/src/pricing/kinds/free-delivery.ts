import { z } from 'zod';
import { invalidOfferConfig } from '../error-codes';
import { thresholdSchema } from './threshold';

/**
 * Configuration of a free-delivery offer: only its threshold. Delivery methods and wilayas are filtered by the
 * offer's eligibility, the one source of truth (D2413).
 */
export const freeDeliveryConfigSchema = z.object(
  { threshold: thresholdSchema.prefault({ type: 'none' }) },
  invalidOfferConfig,
);

export type FreeDeliveryConfig = z.output<typeof freeDeliveryConfigSchema>;
