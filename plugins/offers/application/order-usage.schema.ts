import { invalidQuoteRequest, isSnowflake, MAX_CODE_INPUT_LENGTH, MAX_QUOTE_CODES } from '@cod/shared';
import { z } from 'zod';
import { MAX_ORDER_HELD_OFFERS } from '../domain/constants';
import type { OrderUsage } from '../domain/engine/order-usage';
import { InvalidQuoteRequestError } from '../domain/errors';

/** An offer id: a canonical snowflake, as the offer table stores it. */
const offerIdSchema = z.string(invalidQuoteRequest).refine(isSnowflake, invalidQuoteRequest);

/** An order's held uses as the re-pricing caller states them: bounded like the order they were read from (D2427). */
const orderUsageSchema = z.object(
  {
    buyerOrdersBefore: z
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .nonnegative(invalidQuoteRequest)
      .nullish(),
    offerIds: z.array(offerIdSchema, invalidQuoteRequest).max(MAX_ORDER_HELD_OFFERS, invalidQuoteRequest),
    codes: z
      .array(z.string(invalidQuoteRequest).max(MAX_CODE_INPUT_LENGTH, invalidQuoteRequest), invalidQuoteRequest)
      .max(MAX_QUOTE_CODES, invalidQuoteRequest),
  },
  invalidQuoteRequest,
);

/**
 * The order usage, checked before any count is given back.
 *
 * @throws {@link InvalidQuoteRequestError} when it breaks its bounds.
 */
export function parseOrderUsage(raw: unknown): OrderUsage {
  const parsed = orderUsageSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidQuoteRequestError();
  return parsed.data;
}
