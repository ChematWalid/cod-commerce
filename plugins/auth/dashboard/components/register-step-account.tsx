import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { SyntheticEvent, ReactNode } from 'react';
import type { RegisterWizard } from '../hooks/use-register-wizard';
import { TextField } from './text-field';

function NameFields({ wizard }: { readonly wizard: RegisterWizard }): ReactNode {
  const { i18n } = useLingui();
  const { values, errors, set } = wizard;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label={i18n._('First name')}
        autoComplete="given-name"
        value={values.firstName}
        errorId={errors['firstName']}
        onChange={(event) => {
          set('firstName', event.target.value);
        }}
      />
      <TextField
        label={i18n._('Last name')}
        autoComplete="family-name"
        value={values.lastName}
        errorId={errors['lastName']}
        onChange={(event) => {
          set('lastName', event.target.value);
        }}
      />
    </div>
  );
}

/** Step 1: who the merchant is. */
export function RegisterStepAccount({ wizard }: { readonly wizard: RegisterWizard }): ReactNode {
  const { i18n } = useLingui();
  const { values, errors, set, next } = wizard;
  const onSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    next();
  };
  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <TextField
        label={i18n._('Email')}
        type="email"
        autoComplete="email"
        dir="ltr"
        value={values.email}
        errorId={errors['email']}
        onChange={(event) => {
          set('email', event.target.value);
        }}
      />
      <TextField
        label={i18n._('Password')}
        isPassword
        autoComplete="new-password"
        hint={i18n._('At least 8 characters')}
        value={values.password}
        errorId={errors['password']}
        onChange={(event) => {
          set('password', event.target.value);
        }}
      />
      <NameFields wizard={wizard} />
      <Button type="submit" className="w-full">
        {i18n._('Continue')}
      </Button>
    </form>
  );
}
