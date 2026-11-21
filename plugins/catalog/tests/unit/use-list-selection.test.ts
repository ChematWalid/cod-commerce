import type { ProductListQueryInput } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListSelection } from '../../dashboard/hooks/use-list-selection';

/**
 * A one-component stand-in for React's `useState` (the repo has no render tooling): state set while rendering re-runs
 * the render until it settles, as React does for the "adjust state on prop change" pattern.
 */
const harness = vi.hoisted(() => {
  const cells: unknown[] = [];
  const run = { cursor: 0, writes: 0 };
  const useState = (initial: unknown) => {
    const index = run.cursor++;
    if (!(index in cells)) cells[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    const set = (value: unknown): void => {
      const next = typeof value === 'function' ? (value as (current: unknown) => unknown)(cells[index]) : value;
      if (Object.is(next, cells[index])) return;
      cells[index] = next;
      run.writes += 1;
    };
    return [cells[index], set];
  };
  const render = <T>(component: () => T): T => {
    for (let pass = 0; pass < 25; pass += 1) {
      run.cursor = 0;
      const writesBefore = run.writes;
      const output = component();
      if (run.writes === writesBefore) return output;
    }
    throw new Error('render did not settle');
  };
  const reset = (): void => {
    cells.length = 0;
  };
  return { useState, render, reset };
});

// Hoisted above the imports by vitest, so the hook module sees the stand-in.
vi.mock('react', () => ({ useState: harness.useState }));

const STORE_1 = '1001';
const STORE_2 = '1002';
const queryOf = (tab: string, search?: string): ProductListQueryInput =>
  ({ tab, skip: 0, take: 20, ...(search === undefined ? {} : { search }) }) as ProductListQueryInput;

describe('useListSelection', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('keeps a selection cleared after the tab changes and then changes back', () => {
    // Arrange
    const ticked = harness.render(() => useListSelection(STORE_1, queryOf('all')));
    ticked.toggle('1', true);
    ticked.toggle('2', true);
    expect(harness.render(() => useListSelection(STORE_1, queryOf('all'))).selection.ids).toEqual(['1', '2']);

    // Act
    const otherTab = harness.render(() => useListSelection(STORE_1, queryOf('hidden')));
    const back = harness.render(() => useListSelection(STORE_1, queryOf('all')));

    // Assert
    expect(otherTab.selection.ids).toEqual([]);
    expect(back.selection.ids).toEqual([]);
  });

  it('keeps a selection cleared after a search is typed and then deleted', () => {
    // Arrange
    harness.render(() => useListSelection(STORE_1, queryOf('all'))).toggle('7', true);

    // Act
    harness.render(() => useListSelection(STORE_1, queryOf('all', 'shoe')));
    const back = harness.render(() => useListSelection(STORE_1, queryOf('all')));

    // Assert
    expect(back.selection.ids).toEqual([]);
  });

  it('keeps a selection cleared after a store switch and a switch back', () => {
    // Arrange
    harness.render(() => useListSelection(STORE_1, queryOf('all'))).toggle('7', true);

    // Act
    harness.render(() => useListSelection(STORE_2, queryOf('all')));
    const back = harness.render(() => useListSelection(STORE_1, queryOf('all')));

    // Assert
    expect(back.selection.ids).toEqual([]);
  });

  it('keeps the selection when only the page changes', () => {
    // Arrange
    harness.render(() => useListSelection(STORE_1, queryOf('all'))).toggle('7', true);

    // Act
    const nextPage = harness.render(() => useListSelection(STORE_1, { ...queryOf('all'), skip: 20 }));

    // Assert
    expect(nextPage.selection.ids).toEqual(['7']);
  });
});
