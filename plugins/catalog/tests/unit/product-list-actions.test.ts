import { CATALOG_CREATE_PRODUCT_ACTION_ID } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CREATE_PRODUCTS_KEY, EDIT_PRODUCTS_KEY, VIEW_PRODUCTS_KEY } from '../../dashboard/constants';
import {
  actionItemsShown,
  CREATE_PRODUCT_ACTION,
  listPageEntityOf,
  type ListActionItem,
} from '../../dashboard/model/product-list-actions';

const exportItem: ListActionItem = { id: 'stub-export', requires: VIEW_PRODUCTS_KEY };
const bulkEditItem: ListActionItem = { id: 'stub-bulk-edit', requires: EDIT_PRODUCTS_KEY };

describe('product list actions', () => {
  it('the action bar renders for a viewer; a stub item gated per permission shows Export only', () => {
    // Arrange
    const viewer = new Set<string>([VIEW_PRODUCTS_KEY]);

    // Act
    const shown = actionItemsShown([CREATE_PRODUCT_ACTION, exportItem, bulkEditItem], viewer);

    // Assert
    expect(shown.map((item) => item.id)).toEqual(['stub-export']);
  });

  it('shows Create product to a holder of the create key', () => {
    // Act
    const shown = actionItemsShown([CREATE_PRODUCT_ACTION], new Set<string>([CREATE_PRODUCTS_KEY]));

    // Assert
    expect(shown.map((item) => item.id)).toEqual([CATALOG_CREATE_PRODUCT_ACTION_ID]);
  });

  it("hands the action bar the list's query and the selected ids", () => {
    // Act
    const entity = listPageEntityOf({ tab: 'draft', q: ' shoe ', skip: 20, take: 20 }, ['3', '4']);

    // Assert
    expect(entity).toEqual({ query: { tab: 'draft', q: 'shoe', skip: 20, take: 20 }, selectedIds: ['3', '4'] });
  });
});
