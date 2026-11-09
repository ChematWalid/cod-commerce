import { useLingui } from '@lingui/react';
import { toast } from '@vendure/dashboard';
import { type SyntheticEvent, useState } from 'react';
import { errorCodeOf, errorMessageId } from '../error-messages';
import { type FieldErrors, hasFieldErrors } from '../field-errors';

const WRONG_PASSWORD_CODE = 'auth.current-password-wrong';

interface AccountFormOptions<T extends Readonly<Record<string, string>>> {
  readonly initial: T;
  readonly validate: (values: T) => FieldErrors;
  /** Saves and returns what the form should show next. */
  readonly save: (values: T) => Promise<T>;
  /** The field that shows a refused current password. */
  readonly passwordField?: keyof T & string;
}

interface FieldBinding {
  readonly value: string;
  readonly errorId: string | undefined;
  readonly onChange: (event: { readonly target: { readonly value: string } }) => void;
}

export interface AccountForm<T> {
  readonly values: T;
  readonly saving: boolean;
  readonly field: (name: keyof T & string) => FieldBinding;
  readonly submit: (event: SyntheticEvent) => void;
}

/** The state every account form shares: instant validation, one save at a time, and how refusals are shown. */
export function useAccountForm<T extends Readonly<Record<string, string>>>(
  options: AccountFormOptions<T>,
): AccountForm<T> {
  const { i18n } = useLingui();
  const [values, setValues] = useState(options.initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const showFailure = (error: unknown): void => {
    if (errorCodeOf(error) === WRONG_PASSWORD_CODE && options.passwordField !== undefined) {
      setErrors({ [options.passwordField]: WRONG_PASSWORD_CODE });
      return;
    }
    toast.error(i18n._(errorMessageId(error)));
  };
  const run = async (): Promise<void> => {
    setSaving(true);
    try {
      setValues(await options.save(values));
    } catch (error: unknown) {
      showFailure(error);
    } finally {
      setSaving(false);
    }
  };
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const found = options.validate(values);
    setErrors(found);
    if (!hasFieldErrors(found) && !saving) void run();
  };
  const field = (name: keyof T & string): FieldBinding => ({
    value: values[name] ?? '',
    errorId: errors[name],
    onChange: (event) => {
      setValues({ ...values, [name]: event.target.value });
    },
  });
  return { values, saving, field, submit };
}
