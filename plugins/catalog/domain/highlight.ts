import { type BusinessId, HIGHLIGHT_TEXT_MAX, type Snowflake, type StoreId } from '@cod/shared';
import { singleLineText } from './single-line-text';
import type { StoreScope } from './store-scope';

/** A short selling point of one store that its products may show, at most six per product (brief AC3). */
export interface Highlight {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly text: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What a new highlight is made from. */
export interface NewHighlight {
  readonly id: Snowflake;
  readonly scope: StoreScope;
  readonly text: string;
  readonly now: Date;
}

/**
 * A new highlight of the scope's store. Two highlights may share a text: unlike brand and tag names, nothing looks a
 * highlight up by its text.
 *
 * @throws {InvalidCatalogInputError} when the text is blank, longer than `HIGHLIGHT_TEXT_MAX` or not one plain line.
 */
export function createHighlight({ id, scope, text, now }: NewHighlight): Highlight {
  const value = singleLineText(text, HIGHLIGHT_TEXT_MAX);
  return { id, businessId: scope.businessId, storeId: scope.storeId, text: value, createdAt: now, updatedAt: now };
}

/** `highlight` with a new text; same rules as {@link createHighlight}. */
export function rewordHighlight(highlight: Highlight, text: string, now: Date): Highlight {
  return { ...highlight, text: singleLineText(text, HIGHLIGHT_TEXT_MAX), updatedAt: now };
}
