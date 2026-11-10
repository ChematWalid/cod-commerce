import { describe, expect, it } from 'vitest';
import { mergeNewestFirst } from '../../domain/newest-first';

const at = (id: string, minute: number): { id: string; createdAt: Date } => ({
  id,
  createdAt: new Date(Date.UTC(2026, 10, 10, 10, minute)),
});

describe('mergeNewestFirst', () => {
  it('merges pages newest first, then applies skip and take', () => {
    // Arrange
    const critical = { items: [at('c3', 30), at('c1', 10)], totalItems: 2 };
    const bulk = { items: [at('b4', 40), at('b2', 20)], totalItems: 5 };

    // Act
    const page = mergeNewestFirst([critical, bulk], 1, 2);

    // Assert
    expect(page.items.map((item) => item.id)).toEqual(['c3', 'b2']);
    expect(page.totalItems).toBe(7);
  });
});
