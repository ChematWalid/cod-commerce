import { useLingui } from '@lingui/react';
import { Input, Label, Switch } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';

interface SwitchFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly testId?: string;
  readonly onChange: (checked: boolean) => void;
}

/** One on/off setting: its label and hint at the start, the switch at the end of the row. */
export function SwitchField({ label, hint, checked, disabled, testId, onChange }: SwitchFieldProps): ReactNode {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <Switch
        id={id}
        data-testid={testId}
        className="shrink-0"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(on) => {
          onChange(on);
        }}
      />
    </div>
  );
}

interface NumberFieldProps {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly invalid?: boolean;
  readonly placeholder?: string;
  readonly testId?: string;
  readonly onChange: (value: string) => void;
}

/** A whole-number field (DZD or kg), typed left to right in either language; its label is visible above it. */
export function NumberField({ label, value, invalid = false, testId, onChange, ...rest }: NumberFieldProps): ReactNode {
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        data-testid={testId}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        {...rest}
      />
    </div>
  );
}

/** The refusal under a field the save refused. */
export function FieldError({ shown, messageId }: { readonly shown: boolean; readonly messageId: string }): ReactNode {
  const { i18n } = useLingui();
  if (!shown) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {i18n._(messageId)}
    </p>
  );
}
