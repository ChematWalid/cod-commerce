import { MONEY_MAX_DZD } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Input, Label } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import type { StoreCollectionConditionDto } from '../dto';

export interface ConditionInputProps {
  readonly condition: StoreCollectionConditionDto;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<StoreCollectionConditionDto>) => void;
}

const WHOLE_NUMBER = /^\d+$/;

/** A typed bound in whole DZD, or null when the field is empty or not a whole number (the row then stays incomplete). */
function boundOf(text: string): number | null {
  const trimmed = text.trim();
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : null;
}

function BoundInput(props: {
  readonly labelId: string;
  readonly value: number | null | undefined;
  readonly disabled: boolean;
  readonly onChange: (value: number | null) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{i18n._(props.labelId)}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MONEY_MAX_DZD}
        step={1}
        dir="ltr"
        className="w-32"
        disabled={props.disabled}
        value={props.value ?? ''}
        onChange={(event) => {
          props.onChange(boundOf(event.target.value));
        }}
      />
    </div>
  );
}

/** "Price between": an inclusive range in whole DZD, either bound may stay empty (D2303). */
export function PriceRangeField({ condition, disabled, onChange }: ConditionInputProps): ReactNode {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <BoundInput
        labelId="collections.price-min"
        value={condition.min}
        disabled={disabled}
        onChange={(min) => {
          onChange({ min });
        }}
      />
      <BoundInput
        labelId="collections.price-max"
        value={condition.max}
        disabled={disabled}
        onChange={(max) => {
          onChange({ max });
        }}
      />
    </div>
  );
}
