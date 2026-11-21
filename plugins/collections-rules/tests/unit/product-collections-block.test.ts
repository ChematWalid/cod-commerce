import { describe, expect, it } from 'vitest';
import type { StoreCollectionDto, StoreProductCollectionsDto } from '../../dashboard/dto';
import {
  collectionIdsToSend,
  manualChoicesOf,
  productCollectionsViewOf,
  samePicks,
} from '../../dashboard/model/product-collections';

const ANSWER: StoreProductCollectionsDto = {
  manual: [{ id: '11', title: 'Gifts' }],
  automatic: [{ id: '21', title: 'Promo' }],
};

const collection = (id: string, title: string, mode: 'manual' | 'automatic'): StoreCollectionDto => ({
  id,
  title,
  slug: title.toLowerCase(),
  description: null,
  featuredAsset: null,
  mode,
  rule: null,
  visible: true,
  position: 0,
  productCount: 1,
});

describe('product collections block', () => {
  it('sends manual ids only', () => {
    // Arrange
    const picked = ['11', '21', '12'];

    // Act
    const sent = collectionIdsToSend(picked, ANSWER);

    // Assert
    expect(sent).toEqual(['11', '12']);
  });

  it('lists automatic ones read-only', () => {
    // Arrange
    const store = [
      collection('11', 'Gifts', 'manual'),
      collection('12', 'New', 'manual'),
      collection('21', 'Promo', 'automatic'),
    ];

    // Act
    const view = productCollectionsViewOf(ANSWER);
    const choices = manualChoicesOf(store, ANSWER);

    // Assert
    expect(view).toEqual({ manualIds: ['11'], byRule: [{ id: '21', title: 'Promo' }] });
    expect(choices).toEqual([
      { id: '11', title: 'Gifts' },
      { id: '12', title: 'New' },
    ]);
  });

  it('still offers a manual collection of the product the loaded list does not hold', () => {
    // Act
    const choices = manualChoicesOf([collection('12', 'New', 'manual')], ANSWER);

    // Assert
    expect(choices).toEqual([
      { id: '12', title: 'New' },
      { id: '11', title: 'Gifts' },
    ]);
  });

  it('tells an unchanged pick from a changed one, whatever the order', () => {
    // Act / Assert
    expect(samePicks(['11', '12'], ['12', '11'])).toBe(true);
    expect(samePicks(['11'], ['11', '12'])).toBe(false);
  });
});
