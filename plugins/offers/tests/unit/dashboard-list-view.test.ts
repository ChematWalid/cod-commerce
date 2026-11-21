import { OFFER_PAGE_SIZE, PRICING_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CREATE_OFFERS_KEY, DELETE_OFFERS_KEY, EDIT_OFFERS_KEY } from '../../dashboard/constants';
import {
  clampPage,
  INITIAL_LIST_STATE,
  isNarrowed,
  listQueryOf,
  withFilter,
  withPage,
} from '../../dashboard/model/list-search';
import {
  FORBIDDEN_MESSAGE_ID,
  GENERIC_ERROR_MESSAGE_ID,
  listErrorMessageId,
  methodCellOf,
  performanceCellsOf,
  rowActionsOf,
  STORE_SWITCHED_MESSAGE_ID,
} from '../../dashboard/model/list-view';
import { StoreSwitchedError } from '../../dashboard/model/store-bound-fetch';

describe('offer list search', () => {
  it('builds list search from status tab, kind chip and page', () => {
    // Arrange
    const state = withPage(withFilter(INITIAL_LIST_STATE, { tab: 'paused', kind: 'bxgy' }), 3);

    // Act
    const query = listQueryOf(state);
    const first = listQueryOf(INITIAL_LIST_STATE);

    // Assert
    expect(query).toEqual({ status: 'paused', kind: 'bxgy', skip: 2 * OFFER_PAGE_SIZE, take: OFFER_PAGE_SIZE });
    expect(first).toEqual({ skip: 0, take: OFFER_PAGE_SIZE });
    expect(isNarrowed(query)).toBe(true);
    expect(isNarrowed(first)).toBe(false);
  });

  it('starts again at page 1 when the tab or the kind changes, and moves back past the last page', () => {
    // Arrange
    const third = withPage(INITIAL_LIST_STATE, 3);

    // Act
    const filtered = withFilter(third, { kind: 'quantity' });
    const clamped = clampPage(third, OFFER_PAGE_SIZE + 1);

    // Assert
    expect(filtered.page).toBe(1);
    expect(clamped.page).toBe(2);
    expect(clampPage(clamped, OFFER_PAGE_SIZE + 1)).toBe(clamped);
  });
});

describe('offer list columns', () => {
  it('formats performance columns from the DTO', () => {
    // Arrange
    const performance = { orders: 1_200, deliveredRevenue: 1_234_500, discountGiven: 9_800 };

    // Act
    const english = performanceCellsOf(performance, 'en');
    const arabic = performanceCellsOf(performance, 'ar');

    // Assert
    expect(english).toEqual({ orders: '1,200', deliveredRevenue: '1,234,500', discountGiven: '9,800' });
    expect(arabic).toEqual({ orders: '1.200', deliveredRevenue: '1.234.500', discountGiven: '9.800' });
  });

  it('shows the code count beside the codes method only', () => {
    // Act
    const automatic = methodCellOf({ method: 'automatic', codeCount: 0 });
    const codes = methodCellOf({ method: 'codes', codeCount: 12 });

    // Assert
    expect(automatic).toEqual({ labelId: 'offers.method-automatic', codeCount: null });
    expect(codes).toEqual({ labelId: 'offers.method-codes', codeCount: 12 });
  });
});

describe('offer row actions', () => {
  it('offers only Edit to a viewer', () => {
    // Act
    const actions = rowActionsOf({ allowedMoves: ['pause', 'archive'], deletable: false }, new Set());

    // Assert
    expect(actions).toEqual(['edit']);
  });

  it('offers the moves and the deletion the server allows to an editor, publishing only in the editor', () => {
    // Arrange
    const held = new Set([CREATE_OFFERS_KEY, EDIT_OFFERS_KEY, DELETE_OFFERS_KEY]);
    const allowed = [
      { allowedMoves: ['publish', 'archive'], deletable: true },
      { allowedMoves: ['pause', 'archive'], deletable: false },
      { allowedMoves: ['resume', 'archive'], deletable: false },
      { allowedMoves: [], deletable: false },
    ] as const;

    // Act
    const byStatus = allowed.map((offer) => rowActionsOf(offer, held));

    // Assert
    expect(byStatus).toEqual([
      ['edit', 'duplicate', 'archive', 'delete'],
      ['edit', 'duplicate', 'pause', 'archive'],
      ['edit', 'duplicate', 'resume', 'archive'],
      ['edit', 'duplicate'],
    ]);
  });
});

describe('offer list error messages', () => {
  const graphQlError = (code: string) => ({ message: 'x', extensions: { code } });

  it.each([
    [graphQlError(PRICING_ERROR_CODES.OFFER_NOT_DELETABLE), PRICING_ERROR_CODES.OFFER_NOT_DELETABLE],
    [graphQlError('FORBIDDEN'), FORBIDDEN_MESSAGE_ID],
    [graphQlError('INTERNAL_SERVER_ERROR'), GENERIC_ERROR_MESSAGE_ID],
    [new StoreSwitchedError(), STORE_SWITCHED_MESSAGE_ID],
    [new Error('network'), GENERIC_ERROR_MESSAGE_ID],
  ])('maps %o to its message', (error, id) => {
    // Act
    const messageId = listErrorMessageId(error);

    // Assert
    expect(messageId).toBe(id);
  });
});
