import { describe, expect, it } from 'vitest';
import { EDIT_PRODUCTS_KEY, VIEW_PRODUCTS_KEY } from '../../dashboard/constants';
import {
  ORDERS_STOPPED_LABEL_ID,
  SOLD_OUT_LABEL_ID,
  soldOutBadgesOf,
  soldOutOrdersOffered,
} from '../../dashboard/model/sold-out-view';

describe('sold-out marks in the product list (AC6)', () => {
  it.each([
    ['in stock', { soldOut: false, allowOutOfStockOrders: true }, []],
    ['sold out, still taking orders', { soldOut: true, allowOutOfStockOrders: true }, [SOLD_OUT_LABEL_ID]],
    [
      'sold out with orders stopped',
      { soldOut: true, allowOutOfStockOrders: false },
      [SOLD_OUT_LABEL_ID, ORDERS_STOPPED_LABEL_ID],
    ],
    ['in stock with orders stopped earlier', { soldOut: false, allowOutOfStockOrders: false }, []],
  ])('marks a product %s', (_case, settings, labels) => {
    // Act / Assert
    expect(soldOutBadgesOf(settings)).toEqual(labels);
  });

  it('offers Stop orders and Resume orders only on the sold-out tab, to an editor (D2108)', () => {
    // Arrange
    const editor = new Set([VIEW_PRODUCTS_KEY, EDIT_PRODUCTS_KEY]);
    const viewer = new Set([VIEW_PRODUCTS_KEY]);

    // Act / Assert
    expect(soldOutOrdersOffered('sold-out', editor)).toBe(true);
    expect(soldOutOrdersOffered('sold-out', viewer)).toBe(false);
    expect(soldOutOrdersOffered('all', editor)).toBe(false);
  });
});
