import { Label, Switch } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';

interface SwitchRowProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** One on/off setting: its label and hint at the start, the switch at the end of the row. */
export function SwitchRow({ label, hint, checked, disabled, onChange }: SwitchRowProps): ReactNode {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <Switch
        id={id}
        className="cod-catalog-switch shrink-0"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(on) => {
          onChange(on);
        }}
      />
    </div>
  );
}
