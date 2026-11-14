import { META_DESCRIPTION_MAX, META_TITLE_MAX } from '@cod/shared';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Label, Textarea } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import type { SectionProps } from './section-props';

/** The title and description search engines show; empty ones fall back to the product's own. */
export function SeoSection({ form, disabled, onChange }: SectionProps): ReactNode {
  const { i18n } = useLingui();
  const descriptionId = useId();
  return (
    <div className="grid gap-4">
      <TextField
        label={i18n._('catalog.editor-meta-title')}
        value={form.metaTitle}
        maxLength={META_TITLE_MAX}
        disabled={disabled}
        onChange={(event) => {
          onChange({ metaTitle: event.target.value });
        }}
      />
      <div className="grid gap-1.5">
        <Label htmlFor={descriptionId}>{i18n._('catalog.editor-meta-description')}</Label>
        <Textarea
          id={descriptionId}
          value={form.metaDescription}
          maxLength={META_DESCRIPTION_MAX}
          disabled={disabled}
          onChange={(event) => {
            onChange({ metaDescription: event.target.value });
          }}
        />
      </div>
    </div>
  );
}
