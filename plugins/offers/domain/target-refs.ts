import type { OfferTarget } from '@cod/shared';
import type { OfferCatalogRefs } from './ports/target-catalog.port';

/** The target types checked against the store (D2537); collections go through P2.S3's membership seam (D2342). */
const CHECKED_TYPES = {
  variant: 'variantIds',
  product: 'productIds',
  collection: 'collectionIds',
} as const satisfies Record<OfferTarget['refType'], keyof OfferCatalogRefs>;

const distinct = (ids: readonly string[]): string[] => [...new Set(ids)];

const idsOfType = (targets: readonly OfferTarget[], refType: OfferTarget['refType']): string[] =>
  distinct(targets.filter((target) => target.refType === refType).map((target) => target.refId));

/** The variant, product and collection ids `targets` name, each once (D2537, D2342). */
export function catalogRefsOf(targets: readonly OfferTarget[]): OfferCatalogRefs {
  return {
    variantIds: idsOfType(targets, 'variant'),
    productIds: idsOfType(targets, 'product'),
    collectionIds: idsOfType(targets, 'collection'),
  };
}

const refKey = (target: OfferTarget): string => `${target.refType}:${target.refId}`;

/** The targets of `edited` naming a row `stored` does not, whatever their role: an edit checks only those. */
export function addedTargets(stored: readonly OfferTarget[], edited: readonly OfferTarget[]): OfferTarget[] {
  const known = new Set(stored.map(refKey));
  return edited.filter((target) => !known.has(refKey(target)));
}

/** Whether `found` holds every id of `wanted`, by type. */
export function holdsEvery(wanted: OfferCatalogRefs, found: OfferCatalogRefs): boolean {
  return Object.values(CHECKED_TYPES).every((field) => {
    const held = new Set(found[field]);
    return wanted[field].every((id) => held.has(id));
  });
}
