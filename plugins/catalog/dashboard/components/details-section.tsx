import { CARD_CAPTION_MAX, LABEL_MAX, PRODUCT_TITLE_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Label, RichTextEditor } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { EDITOR_TITLE_TEST_ID } from '../constants';
import { FormTextField } from './form-text-field';
import type { ScopedSectionProps } from './section-props';
import { SlugField } from './slug-field';

/** The rich-text description; the server keeps only the allowed tags (D2122). */
function DescriptionField({ form, disabled, onChange }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-1.5">
      <Label>{i18n._('catalog.editor-description')}</Label>
      <RichTextEditor
        value={form.description}
        disabled={disabled}
        onChange={(description) => {
          onChange({ description });
        }}
      />
    </div>
  );
}

/** Title, slug, description, and the short label and caption the store's product cards show. */
export function DetailsSection(props: ScopedSectionProps & { readonly productId: string | null }): ReactNode {
  const { form, disabled, onChange } = props;
  return (
    <div className="grid gap-4">
      <FormTextField
        section={props}
        field="title"
        labelId="catalog.editor-title"
        data-testid={EDITOR_TITLE_TEST_ID}
        maxLength={PRODUCT_TITLE_MAX}
      />
      <SlugField
        scope={props.scope}
        productId={props.productId}
        value={form.slug}
        disabled={disabled}
        onChange={(slug) => {
          onChange({ slug });
        }}
      />
      <DescriptionField {...props} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField
          section={props}
          field="label"
          labelId="catalog.editor-label"
          hintId="catalog.editor-label-hint"
          maxLength={LABEL_MAX}
        />
        <FormTextField
          section={props}
          field="cardCaption"
          labelId="catalog.editor-card-caption"
          maxLength={CARD_CAPTION_MAX}
        />
      </div>
    </div>
  );
}
