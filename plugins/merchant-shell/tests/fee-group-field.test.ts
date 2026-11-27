import { describe, expect, it } from 'vitest';
import {
  feeGroupFieldView,
  type FeeGroupOption,
  feeGroupStatusLabelId,
  readAllFeeGroups,
} from '../dashboard/model/fee-group-field';

const OPTIONS: readonly FeeGroupOption[] = [
  { id: '5', name: 'Platform default prices' },
  { id: '6', name: 'Summer prices' },
];

describe('feeGroupFieldView', () => {
  it('offers the store pricing options to a caller who may see them', () => {
    // Arrange
    const canViewPricing = true;

    // Act
    const view = feeGroupFieldView(canViewPricing, OPTIONS);

    // Assert
    expect(view).toEqual({ kind: 'choose', options: OPTIONS });
  });

  it('shows only whether one is set to a caller without delivery.pricing.view, who has no names to read', () => {
    expect(feeGroupFieldView(false, OPTIONS)).toEqual({ kind: 'status' });
    expect(feeGroupFieldView(false, undefined)).toEqual({ kind: 'status' });
  });

  it('shows only whether one is set until the options have loaded', () => {
    expect(feeGroupFieldView(true, undefined)).toEqual({ kind: 'status' });
  });
});

describe('feeGroupStatusLabelId', () => {
  it('says Set for a store with a default and Not set for one without', () => {
    expect(feeGroupStatusLabelId('5')).toBe('shell.settings.store.fee-group-set');
    expect(feeGroupStatusLabelId(null)).toBe('shell.settings.store.fee-group-not-set');
  });
});

describe('readAllFeeGroups', () => {
  it('reads the pages in turn until the total is reached', async () => {
    // Arrange
    const all = Array.from({ length: 5 }, (_, index) => ({ id: String(index + 1), name: `Option ${String(index)}` }));
    const asked: number[] = [];
    const fetchPage = (skip: number, take: number) => {
      asked.push(skip);
      return Promise.resolve({ items: all.slice(skip, skip + take), totalItems: all.length });
    };

    // Act
    const read = await readAllFeeGroups(fetchPage, 2);

    // Assert
    expect(read).toEqual(all);
    expect(asked).toEqual([0, 2, 4]);
  });

  it('stops on an empty page even when the total says more', async () => {
    // Arrange
    let calls = 0;
    const fetchPage = () => {
      calls += 1;
      return Promise.resolve({ items: [], totalItems: 10 });
    };

    // Act
    const read = await readAllFeeGroups(fetchPage, 2);

    // Assert
    expect(read).toEqual([]);
    expect(calls).toBe(1);
  });
});
