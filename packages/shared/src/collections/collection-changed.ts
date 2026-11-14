import { z } from 'zod';
import { isSnowflake } from '../ids/snowflake';
import { invalidCollectionInput as issue } from './fields';

/** What happened to a collection in a `collection.changed` outbox event (D2335). */
export const COLLECTION_CHANGE_KINDS = ['created', 'updated', 'membership', 'deleted'] as const;

/** One of the {@link COLLECTION_CHANGE_KINDS}. */
export type CollectionChangeKind = (typeof COLLECTION_CHANGE_KINDS)[number];

const VENDURE_ID = /^[1-9]\d{0,18}$/;

/**
 * The payload of a `collection.changed` outbox event (D2335): ids and the kind of change, nothing else. Consumers
 * (P2.S4 offers, P3.S2 cache tags) read the collection by id under their own tenant scope.
 */
export const collectionChangedPayloadSchema = z.object(
  {
    /** The Vendure collection id, as a decimal string. */
    collectionId: z.string(issue).regex(VENDURE_ID, issue),
    storeId: z.string(issue).refine(isSnowflake, issue),
    change: z.enum(COLLECTION_CHANGE_KINDS, issue),
  },
  issue,
);

export type CollectionChangedPayload = z.output<typeof collectionChangedPayloadSchema>;
