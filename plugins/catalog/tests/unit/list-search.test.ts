import { CATALOG_PAGE_SIZE, productListQuerySchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_LIST_STATE,
  listQueryOf,
  pageCountOf,
  type ProductListState,
  withFilter,
  withPage,
} from '../../dashboard/model/list-search';

const filtered: ProductListState = {
  tab: 'draft',
  search: '  red shoe ',
  collectionId: '11',
  brandId: '7000000000000000001',
  tagId: '7000000000000000002',
  page: 3,
};

describe('list search', () => {
  it('combines tab, search and filters into one query', () => {
    // Act
    const query = listQueryOf(filtered);

    // Assert
    expect(query).toEqual({
      tab: 'draft',
      q: 'red shoe',
      collectionId: '11',
      brandId: '7000000000000000001',
      tagId: '7000000000000000002',
      skip: 2 * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    });
    expect(productListQuerySchema.safeParse(query).success).toBe(true);
  });

  it('leaves a blank search and unset filters out of the query', () => {
    // Act
    const query = listQueryOf({ ...INITIAL_LIST_STATE, search: '   ' });

    // Assert
    expect(query).toEqual({ tab: 'all', skip: 0, take: CATALOG_PAGE_SIZE });
  });

  it('resets paging when a filter changes', () => {
    // Act
    const next = [
      withFilter(filtered, { brandId: null }),
      withFilter(filtered, { tab: 'all' }),
      withFilter(filtered, { search: 'blue' }),
      withFilter(filtered, { tagId: '7000000000000000003' }),
    ];

    // Assert
    expect(next.map((state) => state.page)).toEqual([1, 1, 1, 1]);
    expect(next[0]).toEqual({ ...filtered, brandId: null, page: 1 });
  });

  it('keeps the filters when only the page changes', () => {
    // Act
    const next = withPage(filtered, 4);

    // Assert
    expect(next).toEqual({ ...filtered, page: 4 });
  });

  it.each([
    [0, 1],
    [1, 1],
    [CATALOG_PAGE_SIZE, 1],
    [CATALOG_PAGE_SIZE + 1, 2],
  ])('counts %i products as %i pages', (total, pages) => {
    // Act
    const count = pageCountOf(total);

    // Assert
    expect(count).toBe(pages);
  });
});
