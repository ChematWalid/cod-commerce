import { describe, expect, it } from 'vitest';
import {
  emptySelection,
  pageSelectionState,
  selectionFilterKeyOf,
  selectionWithin,
  toggleAllOnPage,
  toggleSelected,
} from '../../dashboard/model/list-selection';

const STORE_1 = '1001';
const STORE_2 = '1002';
const allProducts = selectionFilterKeyOf({ tab: 'all', skip: 0, take: 20 });

describe('list selection', () => {
  it('clears selection on store change and on filter change', () => {
    // Arrange
    const picked = toggleSelected(emptySelection(STORE_1, allProducts), '7', true);
    const drafts = selectionFilterKeyOf({ tab: 'draft', skip: 0, take: 20 });

    // Act
    const sameList = selectionWithin(picked, STORE_1, allProducts);
    const otherStore = selectionWithin(picked, STORE_2, allProducts);
    const otherFilter = selectionWithin(picked, STORE_1, drafts);

    // Assert
    expect(sameList.ids).toEqual(['7']);
    expect(otherStore.ids).toEqual([]);
    expect(otherFilter.ids).toEqual([]);
  });

  it('keeps the selection across pages of one list', () => {
    // Arrange
    const picked = toggleSelected(emptySelection(STORE_1, allProducts), '7', true);

    // Act
    const nextPage = selectionWithin(picked, STORE_1, selectionFilterKeyOf({ tab: 'all', skip: 20, take: 20 }));

    // Assert
    expect(nextPage.ids).toEqual(['7']);
  });

  it('select all selects only the current page', () => {
    // Arrange
    const otherPage = toggleSelected(emptySelection(STORE_1, allProducts), '99', true);

    // Act
    const all = toggleAllOnPage(otherPage, ['1', '2'], true);
    const none = toggleAllOnPage(all, ['1', '2'], false);

    // Assert
    expect(all.ids).toEqual(['99', '1', '2']);
    expect(none.ids).toEqual(['99']);
    expect(pageSelectionState(all, ['1', '2'])).toBe('all');
    expect(pageSelectionState(toggleSelected(none, '1', true), ['1', '2'])).toBe('some');
    expect(pageSelectionState(none, ['1', '2'])).toBe('none');
    expect(pageSelectionState(none, [])).toBe('none');
  });

  it('selects one id once and unselects it', () => {
    // Arrange
    const start = emptySelection(STORE_1, allProducts);

    // Act
    const twice = toggleSelected(toggleSelected(start, '5', true), '5', true);
    const off = toggleSelected(twice, '5', false);

    // Assert
    expect(twice.ids).toEqual(['5']);
    expect(off.ids).toEqual([]);
  });
});
