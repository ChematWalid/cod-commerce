import type { OfferAppType } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { appTypeCards, kindChipsOf, OTHER_APP_TYPE_LABELS } from '../../dashboard/model/app-type-cards';

/** What `offerAppTypes` answers today: the seven built-in cards in catalogue order (D2515). */
const BUILT_IN_APP_TYPES: readonly OfferAppType[] = [
  { id: 'quantity', kind: 'quantity', method: 'automatic', goal: 'sell_more', recommended: true },
  { id: 'free_delivery', kind: 'free_delivery', method: 'automatic', goal: 'delivery', recommended: false },
  { id: 'product_discount', kind: 'product_discount', method: 'automatic', goal: 'stock', recommended: false },
  { id: 'discount_codes', kind: 'product_discount', method: 'codes', goal: 'influencers', recommended: false },
  { id: 'bxgy', kind: 'bxgy', method: 'automatic', goal: null, recommended: false },
  { id: 'order_discount', kind: 'order_discount', method: 'automatic', goal: null, recommended: false },
  { id: 'addon', kind: 'addon', method: 'automatic', goal: null, recommended: false },
];

describe('create dialog cards', () => {
  it('lists the seven app types in catalogue order', () => {
    // Act
    const { all } = appTypeCards(BUILT_IN_APP_TYPES);

    // Assert
    expect(all.map((card) => card.id)).toEqual([
      'quantity',
      'free_delivery',
      'product_discount',
      'discount_codes',
      'bxgy',
      'order_discount',
      'addon',
    ]);
    expect(all.map((card) => card.labelId)).toEqual([
      'offers.app-quantity',
      'offers.app-free-delivery',
      'offers.app-product-discount',
      'offers.app-discount-codes',
      'offers.app-bxgy',
      'offers.app-order-discount',
      'offers.app-addon',
    ]);
    expect(new Set(all.map((card) => card.hintId)).size).toBe(BUILT_IN_APP_TYPES.length);
  });

  it('groups four goal cards with the recommended one first', () => {
    // Arrange: the recommended card comes third, after two goal cards.
    const [quantity, delivery, stock, ...rest] = BUILT_IN_APP_TYPES;
    const shuffled = [delivery, stock, quantity, ...rest].filter((type) => type !== undefined);

    // Act
    const { byGoal } = appTypeCards(shuffled);

    // Assert
    expect(byGoal.map((card) => card.id)).toEqual(['quantity', 'free_delivery', 'product_discount', 'discount_codes']);
    expect(byGoal.map((card) => card.recommended)).toEqual([true, false, false, false]);
    expect(byGoal.map((card) => card.goalLabelId)).toEqual([
      'offers.goal-sell-more',
      'offers.goal-delivery',
      'offers.goal-stock',
      'offers.goal-influencers',
    ]);
  });

  it('keeps one card per goal and labels an app type it does not know with the generic text', () => {
    // Arrange: an app's own card (P9.S8b) under a goal a built-in card already holds.
    const appCard: OfferAppType = {
      id: 'loyalty',
      kind: 'loyalty',
      method: 'automatic',
      goal: 'stock',
      recommended: false,
    };

    // Act
    const { byGoal, all } = appTypeCards([...BUILT_IN_APP_TYPES, appCard]);

    // Assert
    expect(byGoal.map((card) => card.id)).not.toContain('loyalty');
    expect(all.at(-1)).toMatchObject({ id: 'loyalty', ...OTHER_APP_TYPE_LABELS });
  });
});

describe('kind chips', () => {
  it('offers each kind of the app types once, in catalogue order', () => {
    // Act
    const chips = kindChipsOf(BUILT_IN_APP_TYPES);

    // Assert
    expect(chips.map((chip) => chip.kind)).toEqual([
      'quantity',
      'free_delivery',
      'product_discount',
      'bxgy',
      'order_discount',
      'addon',
    ]);
    expect(chips[0]?.labelId).toBe('offers.kind-quantity');
  });
});
