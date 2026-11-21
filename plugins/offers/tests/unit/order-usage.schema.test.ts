import { MAX_LINE_OFFERS_APPLIED, MAX_ORDER_DISCOUNTS_APPLIED, MAX_QUOTE_ADDONS, MAX_QUOTE_LINES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { parseOrderUsage } from '../../application/order-usage.schema';
import { MAX_DELIVERY_OFFERS_APPLIED } from '../../domain/constants';
import { InvalidQuoteRequestError } from '../../domain/errors';

/** Every offer a stored order can hold: line offers, order discounts, the delivery waiver and add-on offers. */
const MOST_HELD =
  MAX_QUOTE_LINES * MAX_LINE_OFFERS_APPLIED +
  MAX_ORDER_DISCOUNTS_APPLIED +
  MAX_DELIVERY_OFFERS_APPLIED +
  MAX_QUOTE_ADDONS;

const usageOf = (count: number) => ({
  offerIds: Array.from({ length: count }, (_, index) => String(7_000 + index)),
  codes: [],
});

describe('parseOrderUsage: held offers bound', () => {
  it('accepts an order holding every line, order, delivery and add-on offer it can apply', () => {
    // Arrange
    const usage = usageOf(MOST_HELD);

    // Act
    const parsed = parseOrderUsage(usage);

    // Assert
    expect(parsed.offerIds).toHaveLength(MOST_HELD);
  });

  it('refuses an order holding one offer more than it can apply', () => {
    // Arrange
    const usage = usageOf(MOST_HELD + 1);

    // Act
    const parse = () => parseOrderUsage(usage);

    // Assert
    expect(parse).toThrow(InvalidQuoteRequestError);
  });
});
