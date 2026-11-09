import { useLingui } from '@lingui/react';
import { Input, Label, PasswordInput } from '@vendure/dashboard';
import { type ComponentProps, type ReactNode, useId } from 'react';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'size'> {
  readonly label: string;
  readonly errorId?: string | undefined;
  readonly hint?: string;
  readonly isPassword?: boolean;
}

/** One labelled input with its hint and its translated error. */
export function TextField({ label, errorId, hint, isPassword = false, ...input }: TextFieldProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const Control = isPassword ? PasswordInput : Input;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Control {...input} id={id} aria-invalid={errorId === undefined ? undefined : true} />
      {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      {errorId !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errorId)}
        </p>
      )}
    </div>
  );
}
