import { PRODUCT_TITLE_MAX } from '@cod/shared';
import { singleLineText } from './single-line-text';

/** A product's title: trimmed, one line, 1 to `PRODUCT_TITLE_MAX` characters, no control or bidi override character. */
export class ProductTitle {
  private constructor(readonly value: string) {}

  /**
   * Trims `raw` and validates it.
   *
   * @throws {InvalidCatalogInputError} when the title is blank, too long or holds a control or bidi override character.
   */
  static create(raw: string): ProductTitle {
    return new ProductTitle(singleLineText(raw, PRODUCT_TITLE_MAX));
  }

  /** Rebuilds a stored title without validating it again: a stricter rule must never make products unreadable. */
  static restore(stored: string): ProductTitle {
    return new ProductTitle(stored);
  }
}
