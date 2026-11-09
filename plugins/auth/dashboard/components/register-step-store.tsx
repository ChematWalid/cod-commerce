import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { SyntheticEvent, ReactNode } from 'react';
import type { RegisterWizard } from '../hooks/use-register-wizard';
import { useSubdomainAvailability } from '../hooks/use-subdomain-availability';
import { LogoPicker } from './logo-picker';
import { StoreLanguageSelect } from './store-language-select';
import { SubdomainField } from './subdomain-field';
import { TextField } from './text-field';

interface CreateActionsProps {
  readonly submitting: boolean;
  readonly canCreate: boolean;
  readonly onBack: () => void;
}

function CreateActions({ submitting, canCreate, onBack }: CreateActionsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex gap-3">
      <Button type="button" variant="outline" className="flex-1" disabled={submitting} onClick={onBack}>
        {i18n._('Back')}
      </Button>
      <Button type="submit" className="flex-1" disabled={!canCreate}>
        {i18n._('Create')}
      </Button>
    </div>
  );
}

function LanguageAndLogo({ wizard }: { readonly wizard: RegisterWizard }): ReactNode {
  const { i18n } = useLingui();
  const { values, set } = wizard;
  return (
    <>
      <StoreLanguageSelect
        value={values.storeLanguage}
        onChange={(language) => {
          set('storeLanguage', language);
        }}
      />
      <LogoPicker
        label={i18n._('Logo (optional)')}
        hint={i18n._('PNG, JPEG, GIF or WebP, up to 5 MB')}
        file={values.logo}
        onChange={(file) => {
          set('logo', file);
        }}
      />
    </>
  );
}

/** Step 3 and the one submit: Create stays disabled until the latest check says the address is available. */
export function RegisterStepStore({ wizard }: { readonly wizard: RegisterWizard }): ReactNode {
  const { i18n } = useLingui();
  const { values, errors, set, back, submit, submitting } = wizard;
  const check = useSubdomainAvailability(values.subdomain);
  const canCreate = check.state === 'available' && !submitting;
  const onSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (canCreate) void submit();
  };
  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <TextField
        label={i18n._('Store name')}
        value={values.storeName}
        errorId={errors['storeName']}
        onChange={(event) => {
          set('storeName', event.target.value);
        }}
      />
      <SubdomainField
        value={values.subdomain}
        check={check}
        errorId={errors['subdomain']}
        onChange={(value) => {
          set('subdomain', value);
        }}
      />
      <LanguageAndLogo wizard={wizard} />
      {errors['form'] !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errors['form'])}
        </p>
      )}
      <CreateActions submitting={submitting} canCreate={canCreate} onBack={back} />
    </form>
  );
}
