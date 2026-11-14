import type { ProductStatus } from '@cod/shared';
import type { SOLD_OUT_BEHAVIORS, VISIBILITY_CONTEXTS } from './constants';

/** One of the {@link VISIBILITY_CONTEXTS}. */
export type VisibilityContext = (typeof VISIBILITY_CONTEXTS)[number];
/** One of the {@link SOLD_OUT_BEHAVIORS}. */
export type SoldOutBehavior = (typeof SOLD_OUT_BEHAVIORS)[number];

/** What visibility needs to know about a product. */
export interface VisibilitySubject {
  readonly status: ProductStatus;
  readonly soldOut: boolean;
}

/** Statuses shown in each public context; the admin sees every product. */
const STATUSES_SHOWN: Readonly<Record<Exclude<VisibilityContext, 'admin'>, readonly ProductStatus[]>> = {
  listing: ['active'],
  productPage: ['active'],
  landingPage: ['active', 'hidden'],
};

/**
 * Whether `product` shows in `context` (D2109): a draft is never public; a hidden product shows only on a landing
 * page; when the store hides sold-out products, a sold-out one leaves lists and its product page but stays on its
 * landing page.
 */
export function isVisibleIn(
  product: VisibilitySubject,
  context: VisibilityContext,
  soldOutBehavior: SoldOutBehavior,
): boolean {
  if (context === 'admin') {
    return true;
  }
  if (!STATUSES_SHOWN[context].includes(product.status)) {
    return false;
  }
  return context === 'landingPage' || !(product.soldOut && soldOutBehavior === 'hide');
}
