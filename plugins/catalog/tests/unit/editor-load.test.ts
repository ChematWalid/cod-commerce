import { describe, expect, it } from 'vitest';
import { type EditorAnswer, editorLoadViewOf } from '../../dashboard/model/editor-load';
import { GENERIC_ERROR_MESSAGE_ID, STORE_SWITCHED_MESSAGE_ID } from '../../dashboard/model/list-view';
import { StoreSwitchedError } from '../../dashboard/model/store-bound-fetch';

const PRODUCT = { id: '7', title: 'Shoe' };

const answer = (over: Partial<EditorAnswer<typeof PRODUCT>>): EditorAnswer<typeof PRODUCT> => ({
  data: undefined,
  isError: false,
  error: null,
  isPlaceholderData: false,
  ...over,
});

describe('product editor load', () => {
  it('waits while the first answer is on its way', () => {
    // Act
    const view = editorLoadViewOf(answer({}));

    // Assert
    expect(view).toEqual({ kind: 'loading' });
  });

  it('waits while it only holds the answer of another product', () => {
    // Act
    const view = editorLoadViewOf(answer({ data: { id: '6', title: 'Bag' }, isPlaceholderData: true }));

    // Assert
    expect(view).toEqual({ kind: 'loading' });
  });

  it('shows the error of a first load that failed', () => {
    // Act
    const view = editorLoadViewOf(answer({ isError: true, error: new Error('boom') }));

    // Assert
    expect(view).toEqual({ kind: 'error', messageId: GENERIC_ERROR_MESSAGE_ID });
  });

  it('says not found when the store has no such product', () => {
    // Act
    const view = editorLoadViewOf(answer({ data: null }));

    // Assert
    expect(view).toEqual({ kind: 'not-found' });
  });

  it('opens the product once it is loaded', () => {
    // Act
    const view = editorLoadViewOf(answer({ data: PRODUCT }));

    // Assert
    expect(view).toEqual({ kind: 'editor', product: PRODUCT, refetchErrorId: undefined });
  });

  it('keeps the editor open, with a notice, when a later refetch fails', () => {
    // Act
    const view = editorLoadViewOf(answer({ data: PRODUCT, isError: true, error: new Error('offline') }));

    // Assert
    expect(view).toEqual({ kind: 'editor', product: PRODUCT, refetchErrorId: GENERIC_ERROR_MESSAGE_ID });
  });

  it('keeps the editor open and says the store changed when another tab switched it', () => {
    // Act
    const view = editorLoadViewOf(answer({ data: PRODUCT, isError: true, error: new StoreSwitchedError() }));

    // Assert
    expect(view).toEqual({ kind: 'editor', product: PRODUCT, refetchErrorId: STORE_SWITCHED_MESSAGE_ID });
  });
});
