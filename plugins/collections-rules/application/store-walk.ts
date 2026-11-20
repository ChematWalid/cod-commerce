import type { CollectionRule } from '@cod/shared';
import { STORE_WALK_PAGE_SIZE } from '../domain/constants';
import { matchingIds } from '../domain/evaluate-rule';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductFactsPort } from '../domain/ports/product-facts.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * The ids of every product of the store, newest first, walking keyset pages (D2308): an id page never skips or repeats
 * a product when others are written meanwhile. `search` narrows them by title.
 */
export async function storeProductIds(
  facts: ProductFactsPort,
  ctx: OperationContext,
  scope: StoreScope,
  search?: string,
): Promise<string[]> {
  const ids: string[] = [];
  let after: string | null = null;
  do {
    const page = await facts.pageIds(ctx, scope, {
      after,
      take: STORE_WALK_PAGE_SIZE,
      ...(search === undefined ? {} : { search }),
    });
    ids.push(...page.ids);
    after = page.next;
  } while (after !== null);
  return ids;
}

/**
 * The ids of the store's products that match `rule`, newest first (D2318). Each page's facts are read in one batch and
 * matched with one `ProductFacts` object per product and the same rule object, so the evaluator's normalisation memo
 * holds (D2305).
 */
export async function storeMatches(
  facts: ProductFactsPort,
  ctx: OperationContext,
  scope: StoreScope,
  rule: CollectionRule,
): Promise<string[]> {
  const matched: string[] = [];
  let after: string | null = null;
  do {
    const page = await facts.pageIds(ctx, scope, { after, take: STORE_WALK_PAGE_SIZE });
    matched.push(...matchingIds(rule, await facts.factsOf(ctx, scope, page.ids)));
    after = page.next;
  } while (after !== null);
  return matched;
}
