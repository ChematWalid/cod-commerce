import { describe, expect, it } from 'vitest';
import { researchQuote, researchTotalModeOffer } from '../../support/research-fixture';

describe('worked examples of the research (unit 4,900, home 800, desk 500)', () => {
  it('prices 1 piece home at 5700', () => {
    // Act
    const quote = researchQuote(1);

    // Assert
    expect(quote).toMatchObject({ subtotal: 4_900, discountTotal: 0, total: 5_700, savings: 0 });
    expect(quote.delivery).toMatchObject({ resolved: true, fee: 800, price: 800, waived: false });
  });

  it('prices 2 pieces home at 9620 with line 8820', () => {
    // Act
    const quote = researchQuote(2);

    // Assert
    expect(quote.lines[0]).toMatchObject({ quantity: 2, unitPrice: 4_410, totalPrice: 8_820 });
    expect(quote).toMatchObject({ subtotal: 8_820, total: 9_620, savings: 980 });
  });

  it('adds 3920 between 1 and 2 pieces', () => {
    // Act
    const one = researchQuote(1);
    const two = researchQuote(2);

    // Assert
    expect(two.total - one.total).toBe(3_920);
  });

  it('prices 3 pieces home at 12495 with delivery waived and price 0', () => {
    // Act
    const quote = researchQuote(3);

    // Assert
    expect(quote.lines[0]).toMatchObject({ unitPrice: 4_165, totalPrice: 12_495 });
    expect(quote.delivery).toMatchObject({ fee: 800, waived: true, freeShipping: true, price: 0 });
    expect(quote.total).toBe(12_495);
  });

  it('prices 1 piece desk at 5400', () => {
    // Act
    const quote = researchQuote(1, 'desk');

    // Assert
    expect(quote.delivery).toMatchObject({ fee: 500, price: 500, waived: false });
    expect(quote.total).toBe(5_400);
  });

  it('nudges 1 piece with saving 980', () => {
    // Act
    const quote = researchQuote(1);

    // Assert
    expect(quote.nudge).toEqual({ type: 'next_tier', offerId: '7101', units: 1, tierQuantity: 2, saving: 980 });
  });

  it('has no nudge at 3 pieces', () => {
    // Act
    const quote = researchQuote(3);

    // Assert
    expect(quote.nudge).toBeNull();
  });

  it('computes savings 3005 at 3 pieces', () => {
    // Act
    const quote = researchQuote(3);

    // Assert
    expect(quote.savings).toBe(3 * (4_900 - 4_165) + 800);
    expect(quote.savings).toBe(3_005);
  });

  it('prices 3 for 12900 with free delivery at 12900', () => {
    // Act
    const quote = researchQuote(3, 'home', [researchTotalModeOffer()]);

    // Assert
    expect(quote.lines[0]).toMatchObject({ unitPrice: 4_300, totalPrice: 12_900 });
    expect(quote.delivery).toMatchObject({ waived: true, price: 0 });
    expect(quote.total).toBe(12_900);
  });
});
