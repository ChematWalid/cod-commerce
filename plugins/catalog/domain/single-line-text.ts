import { hasBidiControl, hasControlCharacter, hasLoneSurrogate } from '@cod/shared';
import { InvalidCatalogInputError } from './errors';

/**
 * Trims `raw` and returns it when it is a non-blank single line of at most `max` characters without control
 * characters (a NUL breaks Postgres, #171), bidi overrides and isolates (they reorder what is shown, D2144) or lone
 * UTF-16 surrogates (UTF-8 turns them into U+FFFD, so two texts would collide). Arabic direction marks stay.
 *
 * @throws {InvalidCatalogInputError} otherwise; the message never repeats the value.
 */
export function singleLineText(raw: string, max: number): string {
  const value = raw.trim();
  const plain = !hasControlCharacter(value) && !hasBidiControl(value) && !hasLoneSurrogate(value);
  if (value === '' || value.length > max || !plain) {
    throw new InvalidCatalogInputError();
  }
  return value;
}
