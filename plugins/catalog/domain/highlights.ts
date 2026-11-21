import { MAX_PRODUCT_HIGHLIGHTS } from '@cod/shared';
import { TooManyHighlightsError } from './errors';

/**
 * Refuses a product with more than `MAX_PRODUCT_HIGHLIGHTS` highlights (brief AC3).
 *
 * @throws {TooManyHighlightsError} when `ids` holds more.
 */
export function assertHighlightCount(ids: readonly string[]): void {
  if (ids.length > MAX_PRODUCT_HIGHLIGHTS) {
    throw new TooManyHighlightsError();
  }
}
