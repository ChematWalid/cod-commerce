import type { EditorForm, EditorFormErrors } from '../model/editor-form';
import type { StoreScope } from '../queries';

/** What every card of the product editor gets: the form, its refused fields, and how to change it. */
export interface SectionProps {
  readonly form: EditorForm;
  readonly errors: EditorFormErrors;
  /** True when the caller may not save (no edit or create key): the card is read-only. */
  readonly disabled: boolean;
  readonly onChange: (change: Partial<EditorForm>) => void;
}

/** A card that also reads the store's lists (brands, tags, media…). */
export interface ScopedSectionProps extends SectionProps {
  readonly scope: StoreScope | null;
}
