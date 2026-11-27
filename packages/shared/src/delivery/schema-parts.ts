import { z } from 'zod';
import { hasBidiControl, hasControlCharacter, hasLoneSurrogate } from '../text/control-characters';
import { MAX_DELIVERY_PRICE } from './constants';
import { DELIVERY_PRICING_ERROR_CODES } from './error-codes';

/**
 * The issue of every shape refusal of a delivery-pricing body: a code string, not a `{ message }` object, since Zod
 * rewrites a shared params object in place (see `invalidCollectionInput`).
 */
export const deliveryIssue = DELIVERY_PRICING_ERROR_CODES.INVALID_INPUT;

/** True for one line of text with no control, bidi or lone surrogate character. */
export const isCleanLine = (value: string): boolean =>
  !hasControlCharacter(value) && !hasBidiControl(value) && !hasLoneSurrogate(value);

/** A whole number from 0 to `max`. */
export const boundedIntSchema = (max: number) =>
  z.number(deliveryIssue).int(deliveryIssue).min(0, deliveryIssue).max(max, deliveryIssue);

/** A home or stop-desk price of one wilaya or commune, in whole DZD (ADR 0004). */
export const deliveryPriceSchema = boundedIntSchema(MAX_DELIVERY_PRICE);
