import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import type { StartMode } from '../../model/editor-form';
import { ChoiceGroup } from '../choice-group';
import type { SectionProps } from './section-props';

const START_CHOICE_IDS: Readonly<Record<StartMode, string>> = {
  publish: 'offers.editor-start-on-publish',
  date: 'offers.editor-start-on-date',
};

/** Dates are typed in Algeria time (UTC+1), the stock input is left to right whatever the page direction. */
const DATE_INPUT = { type: 'datetime-local', dir: 'ltr' } as const;

function DatesFields({ form, errors, disabled, onChange }: SectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      <ChoiceGroup
        legendId="offers.editor-start"
        value={form.startMode}
        labelIds={START_CHOICE_IDS}
        disabled={disabled}
        onChange={(startMode) => {
          onChange({ startMode });
        }}
      />
      {form.startMode === 'date' && (
        <TextField
          {...DATE_INPUT}
          label={i18n._('offers.editor-starts-at')}
          value={form.startsAt}
          disabled={disabled}
          onChange={(event) => {
            onChange({ startsAt: event.target.value });
          }}
        />
      )}
      <TextField
        {...DATE_INPUT}
        label={i18n._('offers.editor-ends-at')}
        hint={i18n._('offers.editor-dates-hint')}
        value={form.endsAt}
        disabled={disabled}
        errorId={errors.dates}
        onChange={(event) => {
          onChange({ endsAt: event.target.value });
        }}
      />
    </div>
  );
}

function LimitFields({ form, errors, disabled, onChange }: SectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      <TextField
        label={i18n._('offers.editor-total-uses')}
        hint={i18n._('offers.editor-limit-hint')}
        inputMode="numeric"
        value={form.totalUsageLimit}
        disabled={disabled}
        onChange={(event) => {
          onChange({ totalUsageLimit: event.target.value });
        }}
      />
      <TextField
        label={i18n._('offers.editor-per-buyer')}
        inputMode="numeric"
        value={form.perBuyerLimit}
        disabled={disabled}
        errorId={errors.limits}
        onChange={(event) => {
          onChange({ perBuyerLimit: event.target.value });
        }}
      />
    </div>
  );
}

/** When the offer runs and how often it can be used: in all, and per buyer. */
export function DatesLimitsSection(props: SectionProps): ReactNode {
  return (
    <div className="grid gap-6">
      <DatesFields {...props} />
      <LimitFields {...props} />
    </div>
  );
}
