import type { Threshold } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { ChoiceGroup } from '../choice-group';
import { NumberField } from '../number-field';

type ThresholdType = Threshold['type'];

interface ThresholdFieldsProps {
  readonly legendId: string;
  readonly labelIds: Readonly<Record<ThresholdType, string>>;
  readonly value: Threshold;
  readonly disabled: boolean;
  readonly onChange: (next: Threshold) => void;
}

/** The smallest value a fresh threshold starts with; a switch between pieces and amount keeps the typed one. */
const FIRST_MIN = 1;

const MIN_LABEL_IDS: Readonly<Record<Exclude<ThresholdType, 'none'>, string>> = {
  pieces: 'offers.field-min-pieces',
  amount: 'offers.field-min-amount',
};
const MIN_UNIT_IDS: Readonly<Record<Exclude<ThresholdType, 'none'>, string>> = {
  pieces: 'offers.unit-pieces',
  amount: 'offers.unit-dzd',
};

function thresholdOf(type: ThresholdType, previous: Threshold): Threshold {
  if (type === 'none') return { type };
  return { type, min: 'min' in previous ? previous.min : FIRST_MIN };
}

/** When an offer starts to apply (D2412): always, from a number of pieces, or from an amount; shared by two kinds. */
export function ThresholdFields(props: ThresholdFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const { value } = props;
  return (
    <div className="grid gap-3">
      <ChoiceGroup
        legendId={props.legendId}
        value={value.type}
        labelIds={props.labelIds}
        disabled={props.disabled}
        onChange={(type) => {
          props.onChange(thresholdOf(type, value));
        }}
      />
      {value.type !== 'none' && (
        <NumberField
          label={i18n._(MIN_LABEL_IDS[value.type])}
          suffix={i18n._(MIN_UNIT_IDS[value.type])}
          value={value.min}
          disabled={props.disabled}
          onValue={(min) => {
            if (min !== null) props.onChange({ ...value, min });
          }}
        />
      )}
    </div>
  );
}
