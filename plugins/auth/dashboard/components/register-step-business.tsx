import { useLingui } from '@lingui/react';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { Button } from '@vendure/dashboard';
import type { SyntheticEvent, ReactNode } from 'react';
import type { RegisterWizard } from '../hooks/use-register-wizard';

/** Step 2: the business that owns the stores. */
export function RegisterStepBusiness({ wizard }: { readonly wizard: RegisterWizard }): ReactNode {
  const { i18n } = useLingui();
  const { values, errors, set, next, back } = wizard;
  const onSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    next();
  };
  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <TextField
        label={i18n._('Business name')}
        value={values.businessName}
        errorId={errors['businessName']}
        onChange={(event) => {
          set('businessName', event.target.value);
        }}
      />
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={back}>
          {i18n._('Back')}
        </Button>
        <Button type="submit" className="flex-1">
          {i18n._('Continue')}
        </Button>
      </div>
    </form>
  );
}
