import { hasBidiControl, hasControlCharacter } from '@cod/shared';
import { InvalidCatalogInputError } from './errors';

/**
 * Trims `raw` and returns it when it is a non-blank single line of at most `max` characters without control
 * characters (a NUL breaks Postgres, #171) or bidi overrides and isolates (they reorder what is shown, D2144).
 * Arabic direction marks (LRM, RLM, ALM) stay.
 *
 * @throws {InvalidCatalogInputError} otherwise; the message never repeats the value.
 */
export function singleLineText(raw: string, max: number): string {
  const value = raw.trim();
  if (value === '' || value.length > max || hasControlCharacter(value) || hasBidiControl(value)) {
    throw new InvalidCatalogInputError();
  }
  return value;
}
