import type { DiscountValueType } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { ChoiceGroup } from '../choice-group';
import { NumberField } from '../number-field';

/** The percent-or-fixed discount with an optional cap, as product and order discounts store it. */
export interface DiscountValue {
  readonly valueType: DiscountValueType;
  readonly value: number;
  readonly cap: number | null;
}

interface DiscountFieldsProps {
  readonly value: DiscountValue;
  /** The cap's label: per piece for a product discount, on the order for an order discount. */
  readonly capLabelId: string;
  readonly disabled: boolean;
  readonly onChange: (next: DiscountValue) => void;
}

const VALUE_TYPE_IDS: Readonly<Record<DiscountValueType, string>> = {
  percent: 'offers.field-value-percent',
  fixed: 'offers.field-value-fixed',
};
const VALUE_UNIT_IDS: Readonly<Record<DiscountValueType, string>> = {
  percent: 'offers.unit-percent',
  fixed: 'offers.unit-dzd',
};

/** A percent or a fixed amount, its value, and a cap left blank for none (D2409). */
export function DiscountFields({ value, capLabelId, disabled, onChange }: DiscountFieldsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      <ChoiceGroup
        legendId="offers.field-value-type"
        value={value.valueType}
        labelIds={VALUE_TYPE_IDS}
        disabled={disabled}
        onChange={(valueType) => {
          onChange({ ...value, valueType });
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={i18n._('offers.field-value')}
          suffix={i18n._(VALUE_UNIT_IDS[value.valueType])}
          value={value.value}
          disabled={disabled}
          onValue={(next) => {
            if (next !== null) onChange({ ...value, value: next });
          }}
        />
        <NumberField
          label={i18n._(capLabelId)}
          hint={i18n._('offers.field-blank-hint')}
          suffix={i18n._('offers.unit-dzd')}
          value={value.cap}
          disabled={disabled}
          onValue={(cap) => {
            onChange({ ...value, cap });
          }}
        />
      </div>
    </div>
  );
}
