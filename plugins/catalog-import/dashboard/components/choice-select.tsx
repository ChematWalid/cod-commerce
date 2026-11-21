import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';

/** One choice: the value sent and the translated text shown. */
export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface ChoiceSelectProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly choices: readonly Choice<T>[];
  readonly disabled?: boolean;
  readonly testId?: string;
  readonly onChange: (value: T) => void;
}

/** A labelled select among translated choices; a value outside `choices` is ignored. */
export function ChoiceSelect<T extends string>(props: ChoiceSelectProps<T>): ReactNode {
  const id = useId();
  const shown = props.choices.find((choice) => choice.value === props.value)?.label ?? '';
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{props.label}</Label>
      <Select
        value={props.value}
        disabled={props.disabled ?? false}
        onValueChange={(value) => {
          const chosen = props.choices.find((choice) => choice.value === value);
          if (chosen !== undefined) props.onChange(chosen.value);
        }}
      >
        <SelectTrigger id={id} className="w-full" data-testid={props.testId}>
          <SelectValue>{shown}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {props.choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
