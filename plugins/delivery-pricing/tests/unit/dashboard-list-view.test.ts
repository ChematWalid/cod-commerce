import { DELIVERY_PRICING_ERROR_CODES, FEE_GROUP_LIST_PAGE_SIZE } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  CREATE_PRICING_KEY,
  DELETE_PRICING_KEY,
  EDIT_PRICING_KEY,
  VIEW_CARRIERS_KEY,
  VIEW_PRICING_KEY,
} from '../../dashboard/constants';
import { deliveryTabsOf, shownTabOf, tabSearchOf } from '../../dashboard/model/delivery-tabs';
import {
  carrierLabelIdOf,
  errorMessageIdOf,
  FORBIDDEN_MESSAGE_ID,
  GENERIC_ERROR_MESSAGE_ID,
  listInputOf,
  NO_CARRIER_MESSAGE_ID,
  pageWithin,
  rowActionsOf,
} from '../../dashboard/model/list-view';

describe('delivery page tabs', () => {
  it('shows the pricing tab only to a holder of the pricing view key', () => {
    // Arrange
    const carriersOnly = new Set([VIEW_CARRIERS_KEY]);
    const pricingOnly = new Set([VIEW_PRICING_KEY]);
    const both = new Set([VIEW_CARRIERS_KEY, VIEW_PRICING_KEY]);

    // Act
    const tabs = [carriersOnly, pricingOnly, both, new Set<string>()].map(deliveryTabsOf);

    // Assert
    expect(tabs).toEqual([['carriers'], ['pricing'], ['carriers', 'pricing'], []]);
  });

  it('opens the tab the URL asks for when it is shown, else the first shown tab', () => {
    // Arrange
    const both = ['carriers', 'pricing'] as const;
    const carriersOnly = ['carriers'] as const;

    // Act
    const asked = shownTabOf('pricing', both);
    const hidden = shownTabOf('pricing', carriersOnly);
    const unknown = shownTabOf('zones', both);
    const none = shownTabOf(undefined, []);

    // Assert
    expect([asked, hidden, unknown, none]).toEqual(['pricing', 'carriers', 'carriers', null]);
  });

  it('keeps the pricing tab in the URL as ?tab=pricing and the carriers tab as no search', () => {
    // Act
    const searches = [tabSearchOf('pricing'), tabSearchOf('carriers')];

    // Assert
    expect(searches).toEqual([{ tab: 'pricing' }, {}]);
  });
});

describe('pricing list', () => {
  it('offers Edit with the edit key, View with the view key alone, Copy with the create key, Delete with the delete key', () => {
    // Arrange
    const editor = new Set([VIEW_PRICING_KEY, EDIT_PRICING_KEY, DELETE_PRICING_KEY]);
    const viewer = new Set([VIEW_PRICING_KEY, CREATE_PRICING_KEY]);

    // Act
    const actions = [rowActionsOf(editor), rowActionsOf(viewer), rowActionsOf(new Set<string>())];

    // Assert
    expect(actions).toEqual([['edit', 'delete'], ['view', 'copy'], []]);
  });

  it('asks one page by name search, and keeps the page within the total after a delete', () => {
    // Act
    const first = listInputOf({ page: 1, search: '  ' });
    const third = listInputOf({ page: 3, search: ' Yalidine ' });

    // Assert
    expect(first).toEqual({ skip: 0, take: FEE_GROUP_LIST_PAGE_SIZE });
    expect(third).toEqual({ skip: 2 * FEE_GROUP_LIST_PAGE_SIZE, take: FEE_GROUP_LIST_PAGE_SIZE, search: 'Yalidine' });
    expect(pageWithin(3, FEE_GROUP_LIST_PAGE_SIZE * 2)).toBe(2);
    expect(pageWithin(2, 0)).toBe(1);
  });

  it('names a group without a carrier "No carrier"', () => {
    // Act
    const label = carrierLabelIdOf(null);

    // Assert
    expect(label).toBe(NO_CARRIER_MESSAGE_ID);
  });

  it('shows the API code as its own message, forbidden as forbidden, and anything else as generic', () => {
    // Arrange
    const inUse = { extensions: { code: DELIVERY_PRICING_ERROR_CODES.GROUP_IN_USE } };
    const forbidden = { extensions: { code: 'FORBIDDEN' } };

    // Act
    const ids = [inUse, forbidden, new Error('network'), { extensions: { code: 'OTHER' } }].map(errorMessageIdOf);

    // Assert
    expect(ids).toEqual([
      DELIVERY_PRICING_ERROR_CODES.GROUP_IN_USE,
      FORBIDDEN_MESSAGE_ID,
      GENERIC_ERROR_MESSAGE_ID,
      GENERIC_ERROR_MESSAGE_ID,
    ]);
  });
});
