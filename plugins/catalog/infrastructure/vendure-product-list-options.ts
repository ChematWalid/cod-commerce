import { SortOrder } from '@vendure/common/lib/generated-types';
import type { ListQueryOptions, Product } from '@vendure/core';
import type { ProductCriteria } from '../domain/ports/product-catalog.port';

/** The product ids a page is limited to and those it leaves out; an empty exclusion is no filter (`NOT IN ()`). */
function idFilterOf({ productIds, excludedProductIds }: ProductCriteria) {
  const excluded = excludedProductIds ?? [];
  if (productIds === undefined && excluded.length === 0) return undefined;
  return {
    ...(productIds === undefined ? {} : { in: [...productIds] }),
    ...(excluded.length === 0 ? {} : { notIn: [...excluded] }),
  };
}

/** One status and one of a public context's statuses, both when both are given (AND, D2109). */
function statusFilterOf({ status, statuses }: ProductCriteria) {
  if (status === undefined && statuses === undefined) return {};
  return {
    status: {
      ...(status === undefined ? {} : { eq: status }),
      ...(statuses === undefined ? {} : { in: [...statuses] }),
    },
  };
}

/**
 * The Vendure list options of a page: newest first, or ascending ids for `id-asc` (D2218); our custom fields filter
 * by name (D2123).
 */
export function listOptionsOf(criteria: ProductCriteria): ListQueryOptions<Product> {
  const id = idFilterOf(criteria);
  const filter = {
    ...(id === undefined ? {} : { id }),
    ...statusFilterOf(criteria),
    ...(criteria.brandId === undefined ? {} : { brandId: { eq: criteria.brandId } }),
  };
  return {
    skip: criteria.skip,
    take: criteria.take,
    sort: criteria.sort === 'id-asc' ? { id: SortOrder.ASC } : { createdAt: SortOrder.DESC },
    filter,
  };
}
