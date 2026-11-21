import { z } from 'zod';
import { isSnowflake, type Snowflake } from '../ids/snowflake';
import { invalidCollectionInput as issue, vendureIdStringSchema } from './fields';

/** What happened to a collection in a `collection.changed` outbox event (D2335). */
export const COLLECTION_CHANGE_KINDS = ['created', 'updated', 'membership', 'deleted'] as const;

/** One of the {@link COLLECTION_CHANGE_KINDS}. */
export type CollectionChangeKind = (typeof COLLECTION_CHANGE_KINDS)[number];

/**
 * The payload of a `collection.changed` outbox event (D2335): ids and the kind of change, nothing else. Consumers
 * (P2.S4 offers, P3.S2 cache tags) read the collection by id under their own tenant scope.
 */
export const collectionChangedPayloadSchema = z.object(
  {
    /** The Vendure collection id, as a decimal string. */
    collectionId: vendureIdStringSchema,
    storeId: z.custom<Snowflake>((value) => typeof value === 'string' && isSnowflake(value), issue),
    change: z.enum(COLLECTION_CHANGE_KINDS, issue),
  },
  issue,
);

export type CollectionChangedPayload = z.output<typeof collectionChangedPayloadSchema>;
