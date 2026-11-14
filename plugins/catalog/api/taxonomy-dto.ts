import type { Highlight } from '../domain/highlight';
import type { CatalogNameEntry } from '../domain/taxonomy';

/** A brand or tag as both API surfaces answer it (`CatalogBrand`, `CatalogTag`): no business, store or name key. */
export interface CatalogNameDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A highlight as both API surfaces answer it (`CatalogHighlight`). */
export interface CatalogHighlightDto {
  readonly id: string;
  readonly text: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const toNameDto = ({ id, name, createdAt, updatedAt }: CatalogNameEntry): CatalogNameDto => ({
  id,
  name,
  createdAt,
  updatedAt,
});

export const toHighlightDto = ({ id, text, createdAt, updatedAt }: Highlight): CatalogHighlightDto => ({
  id,
  text,
  createdAt,
  updatedAt,
});
