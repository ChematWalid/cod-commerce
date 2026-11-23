import { z } from 'zod';
import { isSnowflake, type Snowflake } from '../ids/snowflake';
import { type BusinessId, MAX_BUSINESS_ID } from './tenant-scope';

/**
 * What changed on a store in a `store.changed` outbox event (D3204): its settings (name, description, logo, language,
 * address field, sold-out behaviour, defaults), its status (archived) or its hosts (subdomain).
 */
export const STORE_CHANGE_KINDS = ['settings', 'status', 'domain'] as const;

/** One of the {@link STORE_CHANGE_KINDS}. */
export type StoreChangeKind = (typeof STORE_CHANGE_KINDS)[number];

/** Same text form as `toBusinessId` accepts (ADR 0003). */
const BUSINESS_ID_FORMAT = /^[1-9][0-9]{0,18}$/;

const isBusinessId = (value: unknown): boolean =>
  typeof value === 'string' && BUSINESS_ID_FORMAT.test(value) && BigInt(value) <= MAX_BUSINESS_ID;

/**
 * The payload of a `store.changed` outbox event (D3204): ids and the kind of change, nothing else. Consumers (the
 * storefront revalidation, the storefront projection) read the store again under their own scope.
 */
export const storeChangedPayloadSchema = z.object({
  storeId: z.custom<Snowflake>((value) => typeof value === 'string' && isSnowflake(value)),
  businessId: z.custom<BusinessId>(isBusinessId),
  change: z.enum(STORE_CHANGE_KINDS),
});

export type StoreChangedPayload = z.output<typeof storeChangedPayloadSchema>;
