import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { OFFER_LABEL_MAX, OFFER_TITLE_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import type { SectionProps } from './section-props';

/** The offer's name (for the merchant) and its Arabic headline (what the buyer reads on the order form). */
export function NameSection({ form, errors, disabled, onChange }: SectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4">
      <TextField
        label={i18n._('offers.editor-name')}
        hint={i18n._('offers.editor-name-hint')}
        value={form.title}
        maxLength={OFFER_TITLE_MAX}
        disabled={disabled}
        errorId={errors.title}
        onChange={(event) => {
          onChange({ title: event.target.value });
        }}
      />
      <TextField
        label={i18n._('offers.editor-headline')}
        hint={i18n._('offers.editor-headline-hint')}
        dir="rtl"
        lang="ar"
        value={form.label.ar ?? ''}
        maxLength={OFFER_LABEL_MAX}
        disabled={disabled}
        onChange={(event) => {
          onChange({ label: { ...form.label, ar: event.target.value } });
        }}
      />
    </div>
  );
}
