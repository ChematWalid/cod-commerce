import { CATALOG_IMPORT_ERROR_CODES, MAX_PRODUCT_TAGS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { distinctProductIds, type EditableProduct, planProductEdit } from '../../domain/bulk-edit-plan';

const product: EditableProduct = {
  id: '7',
  status: 'active',
  brandId: '901',
  tagIds: ['801', '802'],
  price: 1000,
  variants: [
    { id: '71', price: 1000 },
    { id: '72', price: 1500 },
  ],
};

describe('bulk edit plan of one product (D2213)', () => {
  it('lists only fields that change', () => {
    // Act
    const plan = planProductEdit(product, { status: 'active', brandId: '902', addTagIds: ['801'] });

    // Assert
    expect(plan.changedFields).toEqual(['brand']);
    expect(plan.status).toBeUndefined();
    expect(plan.patch).toEqual({ brandId: '902' });
  });

  it('changes status, tags and every price, in a fixed field order', () => {
    // Act
    const plan = planProductEdit(product, {
      price: { mode: 'percent', value: 10 },
      removeTagIds: ['801'],
      addTagIds: ['803'],
      status: 'draft',
    });

    // Assert
    expect(plan.changedFields).toEqual(['status', 'tags', 'price']);
    expect(plan.status).toBe('draft');
    expect(plan.patch).toEqual({
      tagIds: ['802', '803'],
      price: 1100,
      variants: [
        { id: '71', price: 1100 },
        { id: '72', price: 1650 },
      ],
    });
  });

  it('a brand cleared with null is a change only when the product has one', () => {
    // Act
    const cleared = planProductEdit(product, { brandId: null });
    const none = planProductEdit({ ...product, brandId: null }, { brandId: null });

    // Assert
    expect(cleared.patch).toEqual({ brandId: null });
    expect(none.changedFields).toEqual([]);
    expect(none.patch).toBeUndefined();
  });

  it('a price change that leaves every price as it was is no change', () => {
    // Act
    const plan = planProductEdit(product, { price: { mode: 'amount', value: 0 } });

    // Assert
    expect(plan.changedFields).toEqual([]);
  });

  it('a price below 0 is the product error price-out-of-range', () => {
    // Act and Assert
    expect(() => planProductEdit(product, { price: { mode: 'amount', value: -1200 } })).toThrow(
      expect.objectContaining({ code: CATALOG_IMPORT_ERROR_CODES.PRICE_OUT_OF_RANGE }),
    );
  });

  it('add and remove the same tag is refused', () => {
    // Act and Assert
    expect(() => planProductEdit(product, { addTagIds: ['803'], removeTagIds: ['803'] })).toThrow(
      expect.objectContaining({ code: CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT }),
    );
  });

  it('more tags than a product may hold is refused for that product', () => {
    // Arrange
    const many = Array.from({ length: MAX_PRODUCT_TAGS }, (_, index) => String(5000 + index));

    // Act and Assert
    expect(() => planProductEdit(product, { addTagIds: many })).toThrow(
      expect.objectContaining({ code: CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT }),
    );
  });

  it('dedupes product ids so a percent change applies once', () => {
    // Act
    const ids = distinctProductIds(['7', '07', '8', '7']);

    // Assert
    expect(ids).toEqual(['7', '8']);
  });
});
