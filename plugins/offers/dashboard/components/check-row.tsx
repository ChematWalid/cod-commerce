import { Checkbox, Label } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';

interface CheckRowProps {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: (on: boolean) => void;
}

/** One labelled check box. */
export function CheckRow(props: CheckRowProps): ReactNode {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={(on) => {
          props.onToggle(on);
        }}
      />
      <Label htmlFor={id} className="font-normal">
        {props.label}
      </Label>
    </div>
  );
}
