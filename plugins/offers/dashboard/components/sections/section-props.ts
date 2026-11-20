import type { OfferEditorForm, OfferFormErrors } from '../../model/editor-form';

/** What every shared card of the offer editor gets: the form, its refused fields, and how to change it. */
export interface SectionProps {
  readonly form: OfferEditorForm;
  readonly errors: OfferFormErrors;
  /** True when the caller may not save (no create or edit key): the card is read-only. */
  readonly disabled: boolean;
  readonly onChange: (change: Partial<OfferEditorForm>) => void;
}
