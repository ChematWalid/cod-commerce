import { CATALOG_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DELETE_PRODUCTS_KEY, EDIT_PRODUCTS_KEY } from '../../dashboard/constants';
import {
  GENERIC_ERROR_MESSAGE_ID,
  FORBIDDEN_MESSAGE_ID,
  formatDzd,
  listErrorMessageId,
  rowActionsOf,
} from '../../dashboard/model/list-view';

describe('product list rows', () => {
  it('offers only Edit and the disabled Preview to a viewer', () => {
    // Act
    const actions = rowActionsOf({ status: 'active' }, new Set());

    // Assert
    expect(actions).toEqual(['edit', 'preview']);
  });

  it('offers Set draft to an editor unless the product is a draft already, and Delete with the delete key', () => {
    // Arrange
    const held = new Set([EDIT_PRODUCTS_KEY, DELETE_PRODUCTS_KEY]);

    // Act
    const active = rowActionsOf({ status: 'hidden' }, held);
    const draft = rowActionsOf({ status: 'draft' }, held);

    // Assert
    expect(active).toEqual(['edit', 'set-draft', 'preview', 'delete']);
    expect(draft).toEqual(['edit', 'preview', 'delete']);
  });
});

describe('list error messages', () => {
  const graphQlError = (code: string) => ({ message: 'x', extensions: { code } });

  it.each([
    [graphQlError(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND), CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND],
    [graphQlError('FORBIDDEN'), FORBIDDEN_MESSAGE_ID],
    [graphQlError('SOMETHING_ELSE'), GENERIC_ERROR_MESSAGE_ID],
    [new Error('network'), GENERIC_ERROR_MESSAGE_ID],
    [undefined, GENERIC_ERROR_MESSAGE_ID],
  ])('maps %o to %s', (error, id) => {
    // Act
    const messageId = listErrorMessageId(error);

    // Assert
    expect(messageId).toBe(id);
  });
});

describe('prices', () => {
  it.each([
    ['en', '12,500'],
    ['ar', '12.500'],
  ])('groups whole DZD with Latin digits in %s', (language, text) => {
    // Act
    const formatted = formatDzd(12_500, language);

    // Assert
    expect(formatted).toBe(text);
  });
});
