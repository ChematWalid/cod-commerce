import { COLLECTION_TITLE_MAX, SLUG_MAX } from '@cod/shared';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Label, RichTextEditor } from '@vendure/dashboard';
import type { ClipboardEvent, DragEvent, ReactNode } from 'react';
import { COLLECTION_TITLE_TEST_ID, SLUG_CHECK_DELAY_MS } from '../constants';
import { useSettled } from '../hooks/use-settled';
import { useSlugAvailability } from '../queries';
import type { ScopedCardProps } from './card-props';
import { FieldError } from './field-error';

const holdsFiles = (data: DataTransfer | null): boolean => (data?.files.length ?? 0) > 0;

/**
 * Stops a pasted or dropped file before the rich-text editor sees it: it would upload it through Vendure's own asset
 * mutation, outside catalog's media library and its checks, and the server strips `<img>` from descriptions anyway.
 */
function blockFiles(event: ClipboardEvent | DragEvent): void {
  const data = 'clipboardData' in event ? event.clipboardData : event.dataTransfer;
  if (!holdsFiles(data)) return;
  event.preventDefault();
  event.stopPropagation();
}

/** What the check says about the settled slug, as a catalogue id; nothing while the field is empty or checking. */
function useSlugVerdict({ scope, collectionId, form }: ScopedCardProps): string | undefined {
  const settled = useSettled(form.slug, SLUG_CHECK_DELAY_MS);
  const check = useSlugAvailability(scope, settled, collectionId);
  if (settled.trim() === '' || settled !== form.slug || !check.isSuccess) return undefined;
  return check.data.available ? 'collections.slug-available' : 'collections.slug-unavailable';
}

/**
 * The collection's URL name in its store. The check runs 500 ms after the last key; the server decides again on save
 * (D2319). An empty slug is made from the title on create and keeps the saved one on edit.
 */
function SlugField(props: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  const verdict = useSlugVerdict(props);
  return (
    <div className="grid gap-1">
      <TextField
        label={i18n._('collections.slug')}
        hint={i18n._(props.collectionId === null ? 'collections.slug-hint-new' : 'collections.slug-hint-edit')}
        value={props.form.slug}
        maxLength={SLUG_MAX}
        disabled={props.disabled}
        errorId={props.errors.slug}
        onChange={(event) => {
          props.onChange({ slug: event.target.value });
        }}
      />
      {verdict !== undefined && (
        <p
          role="status"
          className={verdict === 'collections.slug-unavailable' ? 'text-destructive text-sm' : 'text-sm'}
        >
          {i18n._(verdict)}
        </p>
      )}
    </div>
  );
}

/** The rich-text description; the server keeps only the allowed tags (D2322). */
function DescriptionField({ form, disabled, onChange, errors }: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-1.5" onPasteCapture={blockFiles} onDropCapture={blockFiles}>
      <Label>{i18n._('collections.description')}</Label>
      <RichTextEditor
        value={form.description}
        disabled={disabled}
        onChange={(description) => {
          onChange({ description });
        }}
      />
      <FieldError messageId={errors.description} />
    </div>
  );
}

/** Title, slug and description. */
export function DetailsCard(props: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4">
      <TextField
        label={i18n._('collections.title')}
        data-testid={COLLECTION_TITLE_TEST_ID}
        value={props.form.title}
        maxLength={COLLECTION_TITLE_MAX}
        disabled={props.disabled}
        errorId={props.errors.title}
        onChange={(event) => {
          props.onChange({ title: event.target.value });
        }}
      />
      <SlugField {...props} />
      <DescriptionField {...props} />
    </div>
  );
}
