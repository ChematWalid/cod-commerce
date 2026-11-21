import { describe, expect, it } from 'vitest';
import { blockLoadOf } from '../../dashboard/model/pack-load';

const answer = <T>(data: T | undefined, overrides: { isError?: boolean; isPlaceholderData?: boolean } = {}) => ({
  data,
  isError: false,
  isPlaceholderData: false,
  ...overrides,
});

describe('pack block load (storeQuery placeholders)', () => {
  it('waits while there is no answer yet', () => {
    // Act
    const view = blockLoadOf(answer(undefined));

    // Assert
    expect(view).toEqual({ kind: 'loading' });
  });

  it('waits on the previous key answer shown as a placeholder, never opening the editor on it', () => {
    // Arrange: components A and B shown while the read of A, B and C loads
    const previous = new Map([
      ['A', 'Shirt'],
      ['B', 'Cap'],
    ]);

    // Act
    const view = blockLoadOf(answer(previous, { isPlaceholderData: true }));

    // Assert
    expect(view).toEqual({ kind: 'loading' });
  });

  it('shows an error when the first read fails', () => {
    // Act
    const view = blockLoadOf(answer(undefined, { isError: true }));

    // Assert
    expect(view).toEqual({ kind: 'error' });
  });

  it('opens on a real answer, null included, and keeps it when a later refetch fails', () => {
    // Act
    const ready = blockLoadOf(answer({ id: '30' }));
    const missing = blockLoadOf(answer(null));
    const refetchFailed = blockLoadOf(answer({ id: '30' }, { isError: true }));

    // Assert
    expect(ready).toEqual({ kind: 'ready', data: { id: '30' } });
    expect(missing).toEqual({ kind: 'ready', data: null });
    expect(refetchFailed).toEqual({ kind: 'ready', data: { id: '30' } });
  });
});
