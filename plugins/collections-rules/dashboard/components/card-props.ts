import type { CollectionForm, CollectionFormErrors } from '../model/editor-form';
import type { StoreScope } from '../model/store-query';

/** What every card of the collection editor gets: the form, its refused fields, and how to change it. */
export interface CardProps {
  readonly form: CollectionForm;
  readonly errors: CollectionFormErrors;
  /** True when the caller may not save (no edit or create key): the card is read-only. */
  readonly disabled: boolean;
  readonly onChange: (change: Partial<CollectionForm>) => void;
}

/** A card that also reads the store (slug check, media, product search). */
export interface ScopedCardProps extends CardProps {
  readonly scope: StoreScope | null;
  readonly collectionId: string | null;
}
