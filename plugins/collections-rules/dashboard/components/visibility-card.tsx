import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Label, Switch } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { COLLECTION_POSITION_TEST_ID, COLLECTION_VISIBLE_TEST_ID } from '../constants';
import type { CardProps } from './card-props';

/** Whether the storefront shows the collection (D2318): the label and hint at the start, the switch at the end. */
export function VisibilityCard({ form, disabled, onChange }: CardProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{i18n._('collections.visible')}</Label>
        <p className="text-muted-foreground text-xs">{i18n._('collections.visible-hint')}</p>
      </div>
      <Switch
        id={id}
        data-testid={COLLECTION_VISIBLE_TEST_ID}
        className="cod-collections-switch shrink-0"
        checked={form.visible}
        disabled={disabled}
        onCheckedChange={(visible) => {
          onChange({ visible });
        }}
      />
    </div>
  );
}

/** The collection's place in the store's lists: lower first, ties by age (D2318). */
export function PositionCard({ form, errors, disabled, onChange }: CardProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <TextField
      label={i18n._('collections.position')}
      hint={i18n._('collections.position-hint')}
      data-testid={COLLECTION_POSITION_TEST_ID}
      inputMode="numeric"
      dir="ltr"
      value={form.position}
      disabled={disabled}
      errorId={errors.position}
      onChange={(event) => {
        onChange({ position: event.target.value });
      }}
    />
  );
}
