import { describe, expect, it } from 'vitest';
import { CREATE_OFFERS_KEY, NEW_OFFER_PATH, VIEW_OFFERS_KEY } from '../../dashboard/constants';
import type { OfferPageDto, OfferRowDto } from '../../dashboard/dto';
import {
  newQuantityOfferLinkOf,
  PRODUCT_OFFERS_TAKE,
  type ProductOffersAnswer,
  productOffersQueryOf,
  productOffersShown,
  productOffersViewOf,
} from '../../dashboard/model/product-offers';

const PRODUCT_ID = '42';
const NO_PERFORMANCE = { orders: 0, deliveredRevenue: 0, discountGiven: 0 };

function rowOf(fields: Partial<OfferRowDto> & Pick<OfferRowDto, 'id' | 'kind' | 'status' | 'title'>): OfferRowDto {
  return {
    method: 'automatic',
    startsAt: null,
    endsAt: null,
    codeCount: 0,
    performance: NO_PERFORMANCE,
    ...fields,
  };
}

function answerOf(fields: Partial<ProductOffersAnswer>): ProductOffersAnswer {
  return { data: undefined, isError: false, error: null, isPlaceholderData: false, ...fields };
}

describe('product editor offers block', () => {
  it('hides the block on a new product', () => {
    // Arrange
    const page: OfferPageDto = { items: [], totalItems: 0 };

    // Act
    const view = productOffersViewOf(undefined, answerOf({ data: page }), new Set([CREATE_OFFERS_KEY]));
    const shown = productOffersShown(undefined, new Set([VIEW_OFFERS_KEY]));

    // Assert
    expect(view).toEqual({ kind: 'hidden' });
    expect(shown).toBe(false);
  });

  it('hides the block without offers.view', () => {
    // Arrange
    const forbidden = answerOf({ isError: true, error: { message: 'no', extensions: { code: 'FORBIDDEN' } } });
    const failed = answerOf({ isError: true, error: new Error('network down') });

    // Act
    const view = productOffersViewOf(PRODUCT_ID, forbidden, new Set());
    const other = productOffersViewOf(PRODUCT_ID, failed, new Set());
    const shown = productOffersShown(PRODUCT_ID, new Set([CREATE_OFFERS_KEY]));

    // Assert
    expect(view).toEqual({ kind: 'hidden' });
    expect(shown).toBe(false);
    expect(productOffersShown(PRODUCT_ID, new Set([VIEW_OFFERS_KEY]))).toBe(true);
    expect(other).toEqual({ kind: 'error', messageId: 'offers.error-generic' });
  });

  it("lists the product's offers with kind and status", () => {
    // Arrange
    const page: OfferPageDto = {
      items: [
        rowOf({ id: '7', kind: 'quantity', status: 'active', title: 'Buy more, pay less' }),
        rowOf({ id: '8', kind: 'some_app_kind', status: 'draft', title: 'Draft gift' }),
      ],
      totalItems: 5,
    };

    // Act
    const view = productOffersViewOf(PRODUCT_ID, answerOf({ data: page }), new Set());
    const loading = productOffersViewOf(PRODUCT_ID, answerOf({ data: page, isPlaceholderData: true }), new Set());

    // Assert
    expect(view).toEqual({
      kind: 'list',
      rows: [
        {
          id: '7',
          title: 'Buy more, pay less',
          kindLabelId: 'offers.kind-quantity',
          status: 'active',
          statusLabelId: 'offers.status-active',
        },
        {
          id: '8',
          title: 'Draft gift',
          kindLabelId: 'offers.kind-other',
          status: 'draft',
          statusLabelId: 'offers.status-draft',
        },
      ],
      moreCount: 3,
      canCreate: false,
    });
    expect(loading).toEqual({ kind: 'loading' });
    expect(productOffersQueryOf(PRODUCT_ID)).toEqual({ productId: PRODUCT_ID, skip: 0, take: PRODUCT_OFFERS_TAKE });
  });

  it('links to a new quantity offer for this product', () => {
    // Arrange
    const page: OfferPageDto = { items: [], totalItems: 0 };

    // Act
    const view = productOffersViewOf(PRODUCT_ID, answerOf({ data: page }), new Set([CREATE_OFFERS_KEY]));
    const link = newQuantityOfferLinkOf(PRODUCT_ID);

    // Assert
    expect(view).toMatchObject({ kind: 'list', rows: [], moreCount: 0, canCreate: true });
    expect(link).toEqual({ path: NEW_OFFER_PATH, search: { type: 'quantity', productId: PRODUCT_ID } });
  });
});
