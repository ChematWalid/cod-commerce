import { useLingui } from '@lingui/react';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { STORE_FEE_GROUP_TEST_ID } from '../constants';
import { type FeeGroupFieldView, type FeeGroupOption, feeGroupStatusLabelId } from '../model/fee-group-field';

interface DeliveryFeeGroupFieldProps {
  /** The store's saved or drafted default; null when none is set. */
  readonly value: string | null;
  readonly view: FeeGroupFieldView;
  /** Shows the value without letting it change, for someone without `store.settings.edit`. */
  readonly disabled: boolean;
  readonly onChange: (groupId: string) => void;
}

/** The select of the store's pricing options, labelled by the field's label and described by its hint. */
function FeeGroupSelect({
  id,
  hintId,
  value,
  options,
  disabled,
  onChange,
}: {
  readonly id: string;
  readonly hintId: string;
  readonly value: string | null;
  readonly options: readonly FeeGroupOption[];
  readonly disabled: boolean;
  readonly onChange: (groupId: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <Select
      value={value ?? ''}
      disabled={disabled}
      onValueChange={(groupId) => {
        if (groupId !== null && groupId !== '') onChange(groupId);
      }}
    >
      <SelectTrigger id={id} data-testid={STORE_FEE_GROUP_TEST_ID} className="w-full" aria-describedby={hintId}>
        <SelectValue placeholder={i18n._('shell.settings.store.fee-group-not-set')}>
          {options.find((option) => option.id === value)?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The pricing option a shipping quote uses when nothing narrower applies (issue 207, D3114). A caller who may not
 * see pricing options gets only "Set" or "Not set": there is no name to show without `delivery.pricing.view`.
 */
export function DeliveryFeeGroupField({ value, view, disabled, onChange }: DeliveryFeeGroupFieldProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const hintId = `${id}-hint`;
  const labelId = `${id}-label`;
  return (
    <div className="grid gap-1.5">
      <Label id={labelId} htmlFor={view.kind === 'status' ? undefined : id}>
        {i18n._('shell.settings.store.fee-group')}
      </Label>
      {view.kind === 'status' ? (
        <p data-testid={STORE_FEE_GROUP_TEST_ID} className="text-sm" aria-labelledby={labelId}>
          {i18n._(feeGroupStatusLabelId(value))}
        </p>
      ) : (
        <FeeGroupSelect
          id={id}
          hintId={hintId}
          value={value}
          options={view.options}
          disabled={disabled}
          onChange={onChange}
        />
      )}
      <p id={hintId} className="text-muted-foreground text-xs">
        {i18n._('shell.settings.store.fee-group-hint')}
      </p>
    </div>
  );
}
