import type { ProductType } from '@cod/shared';
import { PACK_PRODUCT_TYPE } from './constants';

/**
 * The parts of a product patch that cross the pack boundary: the type, and every value catalog-packs computes for a
 * pack (prices, the variant matrix, the weight).
 */
export type PackBoundaryPatch = {
  readonly type?: ProductType;
  readonly price?: number;
  readonly oldPrice?: number | null;
  readonly weight?: number | null;
  readonly optionGroups?: readonly unknown[];
  readonly variants?: readonly { readonly price?: number; readonly oldPrice?: number | null }[];
};

const touchesPrice = (patch: PackBoundaryPatch): boolean =>
  patch.price !== undefined ||
  patch.oldPrice !== undefined ||
  (patch.variants ?? []).some((variant) => variant.price !== undefined || variant.oldPrice !== undefined);

const touchesComputedValue = (patch: PackBoundaryPatch): boolean =>
  touchesPrice(patch) || patch.optionGroups !== undefined || patch.weight !== undefined;

/**
 * True when a catalog edit keeps the pack boundary (D2227): no product becomes or stops being a pack through an
 * edit, and a pack's prices, variant matrix and weight are left to catalog-packs, which computes them (D2202,
 * D2203). A pack is created as one.
 */
export function keepsPackBoundary(current: ProductType, patch: PackBoundaryPatch): boolean {
  const isPack = current === PACK_PRODUCT_TYPE;
  if (patch.type !== undefined && (patch.type === PACK_PRODUCT_TYPE) !== isPack) return false;
  return !(isPack && touchesComputedValue(patch));
}

/** The parts of a create command that a pack may not carry: catalog-packs computes them once the pack is composed. */
export type PackCreateCommand = {
  readonly type: ProductType;
  readonly optionGroups: readonly unknown[];
  readonly weight?: number | null;
  readonly oldPrice?: number | null;
};

/**
 * True when a create keeps the pack boundary (D2227): a pack is created with one default variant, no weight and no
 * old price, so it never carries a matrix or a value that the catalog API could not later change and catalog-packs
 * did not compute. Its price is a placeholder until the pack is composed (D2203).
 */
export function createsWithinPackBoundary(command: PackCreateCommand): boolean {
  if (command.type !== PACK_PRODUCT_TYPE) return true;
  return command.optionGroups.length === 0 && (command.weight ?? null) === null && (command.oldPrice ?? null) === null;
}
