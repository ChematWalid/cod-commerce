import { useLingui } from '@lingui/react';
import { Label, RadioGroup, RadioGroupItem } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';

interface ChoiceGroupProps<Value extends string> {
  readonly legendId: string;
  readonly value: Value;
  /** The choices in order, each with its label's catalogue id. */
  readonly labelIds: Readonly<Record<Value, string>>;
  readonly disabled: boolean;
  readonly onChange: (value: Value) => void;
  readonly testId?: string;
}

/** One labelled radio group whose values are the keys of `labelIds`. */
export function ChoiceGroup<Value extends string>(props: ChoiceGroupProps<Value>): ReactNode {
  const { i18n } = useLingui();
  const baseId = useId();
  const values = Object.keys(props.labelIds) as Value[];
  return (
    <fieldset className="grid gap-2" data-testid={props.testId}>
      <legend className="mb-1 text-sm font-medium">{i18n._(props.legendId)}</legend>
      <RadioGroup
        value={props.value}
        disabled={props.disabled}
        onValueChange={(next) => {
          const chosen = values.find((value) => value === next);
          if (chosen !== undefined) props.onChange(chosen);
        }}
      >
        {values.map((value) => (
          <div key={value} className="flex items-center gap-2">
            <RadioGroupItem id={`${baseId}-${value}`} value={value} />
            <Label htmlFor={`${baseId}-${value}`} className="font-normal">
              {i18n._(props.labelIds[value])}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
