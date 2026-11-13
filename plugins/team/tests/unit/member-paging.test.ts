import { MEMBERS_PAGE_SIZE } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { clampedPage, pageCountOf } from '../../dashboard/member-paging';

describe('member paging', () => {
  it('counts one page for an empty tab and rounds a partial page up', () => {
    // Arrange
    const totals = [0, MEMBERS_PAGE_SIZE, MEMBERS_PAGE_SIZE + 1];

    // Act
    const pages = totals.map(pageCountOf);

    // Assert
    expect(pages).toEqual([1, 1, 2]);
  });

  it('falls back to the last page when the tab shrank below the page shown', () => {
    // Arrange: page 2 held the one row past the first page, and it just left the tab
    const total = MEMBERS_PAGE_SIZE;

    // Act
    const page = clampedPage(2, total);

    // Assert
    expect(page).toBe(1);
  });

  it('keeps a page that still holds rows', () => {
    // Arrange
    const total = MEMBERS_PAGE_SIZE * 2 + 3;

    // Act
    const page = clampedPage(2, total);

    // Assert
    expect(page).toBe(2);
  });
});
