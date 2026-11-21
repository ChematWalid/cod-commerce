import { collectionsOf } from '../collections-world';
import { type IsolationCase, ownChannel } from '../matrix';
import { CREATE_OFFER_DOCUMENT, offerNamingCollection, UNKNOWN_TARGETS } from '../offers-operations';
import type { BusinessWorld } from '../world-types';

const UNPROCESSABLE = 422;

/** Which collection a cell names, as the attacker's owner on its own first store. */
interface CollectionTargetCell {
  readonly suffix: string;
  readonly whose: string;
  readonly collectionOf: (attacker: BusinessWorld, victim: BusinessWorld) => string;
}

const COLLECTION_TARGET_CELLS: readonly CollectionTargetCell[] = [
  { suffix: 'foreign-collection', whose: "B's", collectionOf: (_a, b) => collectionsOf(b).automatic.id },
  {
    suffix: 'other-store-collection',
    whose: "A's second store's",
    collectionOf: (a) => collectionsOf(a).otherStore.id,
  },
];

/**
 * A's owner creating an offer on a collection of B, or of A's second store (#273, D2342): the offers check collection
 * targets through P2.S3's registered membership seam, so the create is refused with `offers.unknown-targets` (REST
 * 422) and no offer row is written. Variant and product targets are the `foreign-id` cells of `offers-sweep.ts`.
 */
function collectionTargetCells({ suffix, whose, collectionOf }: CollectionTargetCell): IsolationCase[] {
  return [
    {
      id: `offers.createOffer.${suffix}`,
      entity: 'offer',
      endpoint: 'createOffer',
      access: 'write',
      title: `A's owner calls createOffer naming ${whose} collection: unknown-target`,
      request: (a, b) => ({
        method: 'POST',
        path: '/admin-api',
        caller: a.owner,
        channel: ownChannel(a),
        body: { query: CREATE_OFFER_DOCUMENT, variables: { input: offerNamingCollection(collectionOf(a, b)) } },
      }),
      expect: { kind: 'code', code: UNKNOWN_TARGETS },
      reverse: true,
    },
    {
      id: `offers.post-/offers.${suffix}`,
      entity: 'offer',
      endpoint: 'POST /offers',
      access: 'write',
      title: `A's owner calls POST /offers naming ${whose} collection: ${String(UNPROCESSABLE)}`,
      request: (a, b) => ({
        method: 'POST',
        path: '/offers',
        caller: a.owner,
        channel: ownChannel(a),
        body: offerNamingCollection(collectionOf(a, b)),
      }),
      expect: { kind: 'status', status: UNPROCESSABLE, code: UNKNOWN_TARGETS },
      reverse: true,
    },
  ];
}

/** Every offers collection target cell. */
export const OFFERS_COLLECTION_TARGET_CASES: readonly IsolationCase[] =
  COLLECTION_TARGET_CELLS.flatMap(collectionTargetCells);
