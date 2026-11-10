import { useLingui } from '@lingui/react';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { Button } from '@vendure/dashboard';
import type { SyntheticEvent, ReactNode } from 'react';
import type { OAuthPrefill } from '../hooks/use-oauth-prefill';
import type { RegisterWizard } from '../hooks/use-register-wizard';
import { OAuthProviderButtons } from './oauth-provider-buttons';

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

function PasswordField({ wizard }: { readonly wizard: RegisterWizard }): ReactNode {
  const { i18n } = useLingui();
  const { values, errors, set } = wizard;
  return (
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
  );
}

/** What step 1 needs to know about a provider sign-up; absent for a sign-up with a password. */
interface RegisterStepAccountProps {
  readonly wizard: RegisterWizard;
  readonly oauth: OAuthPrefill | undefined;
}

/** Step 1: who the merchant is. A provider sign-up shows no password field and may fix the email. */
export function RegisterStepAccount({ wizard, oauth }: RegisterStepAccountProps): ReactNode {
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
        readOnly={oauth?.emailLocked === true}
        errorId={errors['email']}
        onChange={(event) => {
          set('email', event.target.value);
        }}
      />
      {oauth === undefined && <PasswordField wizard={wizard} />}
      <NameFields wizard={wizard} />
      <Button type="submit" className="w-full">
        {i18n._('Continue')}
      </Button>
      {oauth === undefined && <OAuthProviderButtons />}
    </form>
  );
}
