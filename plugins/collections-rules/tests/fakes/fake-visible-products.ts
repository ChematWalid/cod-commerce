import type { OperationContext } from '../../domain/ports/operation-context';
import type { ProductPage, VisibleProductsPort } from '../../domain/ports/visible-products.port';

/** What the fake answers: the page's product ids, how many were visible in all, and which read made it. */
export interface FakeProductPage {
  readonly ids: readonly string[];
  readonly totalItems: number;
  readonly read: 'among' | 'newest';
  readonly context: string;
}

/**
 * {@link VisibleProductsPort} for use-case tests: every product is visible unless listed in `hidden`, standing in for
 * the catalog's visibility rules (D2306), which the integration tests cover.
 */
export class FakeVisibleProducts implements VisibleProductsPort<string, FakeProductPage> {
  readonly maxNewestIds = 3;
  readonly hidden = new Set<string>();
  /** The product ids each read was given, in order. */
  readonly given: (readonly string[])[] = [];

  among(_ctx: OperationContext, context: string, productIds: readonly string[], page: ProductPage) {
    return Promise.resolve(this.pageOf('among', context, productIds, page));
  }

  newestAmong(_ctx: OperationContext, context: string, productIds: readonly string[], page: ProductPage) {
    const newest = [...productIds].sort((left, right) => Number(BigInt(right) - BigInt(left)));
    return Promise.resolve(this.pageOf('newest', context, newest.slice(0, this.maxNewestIds), page));
  }

  private pageOf(
    read: FakeProductPage['read'],
    context: string,
    productIds: readonly string[],
    { skip, take }: ProductPage,
  ): FakeProductPage {
    this.given.push(productIds);
    const visible = productIds.filter((id) => !this.hidden.has(id));
    return { ids: visible.slice(skip, skip + take), totalItems: visible.length, read, context };
  }
}
