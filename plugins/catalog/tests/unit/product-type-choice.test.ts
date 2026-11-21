import { PRODUCT_TYPES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { PRODUCT_TYPE_LABEL_IDS, showsTypeChoice } from '../../dashboard/model/product-type-choice';

describe('product type choice', () => {
  it('type choice is shown on create, not on edit', () => {
    // Act
    const onCreate = showsTypeChoice(null);
    const onEdit = showsTypeChoice('41');

    // Assert
    expect(onCreate).toBe(true);
    expect(onEdit).toBe(false);
  });

  it('labels every product type', () => {
    // Assert
    expect(PRODUCT_TYPES.map((type) => PRODUCT_TYPE_LABEL_IDS[type])).toEqual([
      'catalog.type-physical',
      'catalog.type-pack',
    ]);
  });
});
