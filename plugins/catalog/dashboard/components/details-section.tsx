import { CARD_CAPTION_MAX, LABEL_MAX, PRODUCT_TITLE_MAX, PRODUCT_TYPES, type ProductType } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Label,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vendure/dashboard';
import { type ClipboardEvent, type DragEvent, type ReactNode, useId } from 'react';
import { EDITOR_TITLE_TEST_ID, EDITOR_TYPE_TEST_ID } from '../constants';
import { PRODUCT_TYPE_LABEL_IDS, showsTypeChoice } from '../model/product-type-choice';
import { FormTextField } from './form-text-field';
import type { ScopedSectionProps } from './section-props';
import { SlugField } from './slug-field';

const holdsFiles = (data: DataTransfer | null): boolean => (data?.files.length ?? 0) > 0;

/**
 * Stops a pasted or dropped file before the rich-text editor sees it: the editor would upload it through Vendure's
 * own asset mutation, outside the catalog's media library and its checks (D2113), and the server strips `<img>` from
 * descriptions anyway (D2122), which would leave an orphan asset. Product images go through the media card.
 */
function blockFiles(event: ClipboardEvent | DragEvent): void {
  const data = 'clipboardData' in event ? event.clipboardData : event.dataTransfer;
  if (!holdsFiles(data)) return;
  event.preventDefault();
  event.stopPropagation();
}

/** The rich-text description; the server keeps only the allowed tags (D2122). */
function DescriptionField({ form, disabled, onChange }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-1.5" onPasteCapture={blockFiles} onDropCapture={blockFiles}>
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

const isProductType = (value: unknown): value is ProductType => PRODUCT_TYPES.some((type) => type === value);

/** Physical or Pack, chosen when the product is created (D2201 c); a saved product keeps its type. */
function TypeField({ form, disabled, onChange }: ScopedSectionProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('catalog.editor-type')}</Label>
      <Select
        value={form.type}
        disabled={disabled}
        onValueChange={(type) => {
          if (isProductType(type)) onChange({ type });
        }}
      >
        <SelectTrigger id={id} data-testid={EDITOR_TYPE_TEST_ID} className="w-full sm:w-60">
          <SelectValue>{i18n._(PRODUCT_TYPE_LABEL_IDS[form.type])}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRODUCT_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {i18n._(PRODUCT_TYPE_LABEL_IDS[type])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The type on a new product, title, slug, and the short label and caption the store's product cards show. */
export function DetailsSection(props: ScopedSectionProps & { readonly productId: string | null }): ReactNode {
  const { form, disabled, onChange } = props;
  return (
    <div className="grid gap-4">
      {showsTypeChoice(props.productId) && <TypeField {...props} />}
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
