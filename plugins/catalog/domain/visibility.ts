import type { ProductStatus, SoldOutBehavior } from '@cod/shared';
import type { VISIBILITY_CONTEXTS } from './constants';

/** One of the {@link VISIBILITY_CONTEXTS}. */
export type VisibilityContext = (typeof VISIBILITY_CONTEXTS)[number];

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

/** The statuses shown in `context`; `undefined` for the admin, who sees every status. */
export function statusesShownIn(context: VisibilityContext): readonly ProductStatus[] | undefined {
  return context === 'admin' ? undefined : STATUSES_SHOWN[context];
}

/** Whether a sold-out product leaves `context` in a store whose sold-out behaviour is `soldOutBehavior`. */
export const hidesSoldOutIn = (context: VisibilityContext, soldOutBehavior: SoldOutBehavior): boolean =>
  soldOutBehavior === 'hide' && context !== 'landingPage' && context !== 'admin';

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
  const statuses = statusesShownIn(context);
  if (statuses !== undefined && !statuses.includes(product.status)) {
    return false;
  }
  return !(product.soldOut && hidesSoldOutIn(context, soldOutBehavior));
}
