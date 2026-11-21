import type { OfferTarget } from '@cod/shared';
import type { OfferTargetRefs } from './ports/offer-repository.port';

/** The target types checked against the store's catalog; collections wait for P2.S3's seam (D2537). */
const CHECKED_TYPES = { variant: 'variantIds', product: 'productIds' } as const satisfies Partial<
  Record<OfferTarget['refType'], keyof OfferTargetRefs>
>;

const distinct = (ids: readonly string[]): string[] => [...new Set(ids)];

const idsOfType = (targets: readonly OfferTarget[], refType: OfferTarget['refType']): string[] =>
  distinct(targets.filter((target) => target.refType === refType).map((target) => target.refId));

/** The variant and product ids `targets` name, each once; collection targets are left out (D2537). */
export function catalogRefsOf(targets: readonly OfferTarget[]): OfferTargetRefs {
  return { variantIds: idsOfType(targets, 'variant'), productIds: idsOfType(targets, 'product') };
}

const refKey = (target: OfferTarget): string => `${target.refType}:${target.refId}`;

/** The targets of `edited` naming a row `stored` does not, whatever their role: an edit checks only those. */
export function addedTargets(stored: readonly OfferTarget[], edited: readonly OfferTarget[]): OfferTarget[] {
  const known = new Set(stored.map(refKey));
  return edited.filter((target) => !known.has(refKey(target)));
}

/** Whether `found` holds every id of `wanted`, by type. */
export function holdsEvery(wanted: OfferTargetRefs, found: OfferTargetRefs): boolean {
  return Object.values(CHECKED_TYPES).every((field) => {
    const held = new Set(found[field]);
    return wanted[field].every((id) => held.has(id));
  });
}
