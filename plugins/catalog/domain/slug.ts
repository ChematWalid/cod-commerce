import { SLUG_MAX } from '@cod/shared';
import { singleLineText } from './single-line-text';

/**
 * A product slug as the merchant typed it: trimmed, one line, 1 to `SLUG_MAX` characters, no control or bidi override
 * character. Normalising it into URL form (Vendure `normalizeString`) is the infrastructure's job (D2103).
 */
export class Slug {
  private constructor(readonly value: string) {}

  /**
   * Trims `raw` and validates it.
   *
   * @throws {InvalidCatalogInputError} when the slug is blank, too long or holds a control or bidi override character.
   */
  static create(raw: string): Slug {
    return new Slug(singleLineText(raw, SLUG_MAX));
  }
}
