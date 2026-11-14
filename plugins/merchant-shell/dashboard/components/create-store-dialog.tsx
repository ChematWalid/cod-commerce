import { useLingui } from '@lingui/react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { type ReactNode, type SyntheticEvent, useState } from 'react';
import { CREATE_STORE_DIALOG_TEST_ID, CREATE_STORE_RECHECK_TEST_ID, DEFAULT_STORE_LANGUAGE } from '../constants';
import { type CreateStore, useCreateStore } from '../hooks/use-create-store';
import { type SubdomainCheck, useSubdomainAvailability } from '../hooks/use-subdomain-availability';
import { StoreLanguageSelect } from './store-language-select';
import { SubdomainField } from './subdomain-field';
import { TextField } from './text-field';

interface CreateStoreDialogProps {
  readonly open: boolean;
  readonly platformDomain: string | undefined;
  readonly switchTo: (channelId: string) => Promise<void>;
  readonly onOpenChange: (open: boolean) => void;
}

interface CreateStoreForm {
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
}

const EMPTY_FORM: CreateStoreForm = { name: '', subdomain: '', language: DEFAULT_STORE_LANGUAGE };

/** The three inputs of the dialog. */
function CreateStoreFields({
  form,
  check,
  suffix,
  onChange,
}: {
  readonly form: CreateStoreForm;
  readonly check: SubdomainCheck;
  readonly suffix: string | undefined;
  readonly onChange: (form: CreateStoreForm) => void;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <TextField
        label={i18n._('shell.store.create.name')}
        value={form.name}
        onChange={(event) => {
          onChange({ ...form, name: event.target.value });
        }}
      />
      <SubdomainField
        value={form.subdomain}
        check={check}
        suffix={suffix}
        onChange={(subdomain) => {
          onChange({ ...form, subdomain });
        }}
      />
      <StoreLanguageSelect
        value={form.language}
        onChange={(language) => {
          onChange({ ...form, language });
        }}
      />
    </>
  );
}

/**
 * The error line, when there is one, and the buttons. After a timeout the store may already exist, so "check again"
 * takes the place of a second submit (SHELL-8).
 */
function CreateStoreFooter({
  create,
  canSubmit,
  onCancel,
}: {
  readonly create: CreateStore;
  readonly canSubmit: boolean;
  readonly onCancel: () => void;
}): ReactNode {
  const { i18n } = useLingui();
  const { errorId, submitting: busy, recheck: onRecheck } = create;
  return (
    <>
      {errorId !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errorId)}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {i18n._('shell.store.create.cancel')}
        </Button>
        {onRecheck === undefined ? (
          <Button type="submit" disabled={!canSubmit}>
            {i18n._('shell.store.create.submit')}
          </Button>
        ) : (
          <Button type="button" data-testid={CREATE_STORE_RECHECK_TEST_ID} onClick={onRecheck}>
            {i18n._('shell.store.create.recheck')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/** Opens a new store for the merchant's business and switches to it (D87). */
export function CreateStoreDialog({ open, platformDomain, switchTo, onOpenChange }: CreateStoreDialogProps): ReactNode {
  const { i18n } = useLingui();
  const [form, setForm] = useState(EMPTY_FORM);
  const check = useSubdomainAvailability(form.subdomain);
  const close = (): void => {
    setForm(EMPTY_FORM);
    create.close();
    onOpenChange(false);
  };
  const create = useCreateStore(switchTo, close);
  const canSubmit = form.name.trim() !== '' && check.state === 'available' && create.canSubmit;
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (canSubmit) create.submit({ ...form, name: form.name.trim() });
  };
  const change = (next: boolean): void => {
    if (!next && !create.submitting) close();
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent data-testid={CREATE_STORE_DIALOG_TEST_ID}>
        <DialogHeader>
          <DialogTitle>{i18n._('shell.store.create')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <CreateStoreFields
            form={form}
            check={check}
            suffix={platformDomain === undefined ? undefined : `.${platformDomain}`}
            onChange={setForm}
          />
          <CreateStoreFooter create={create} canSubmit={canSubmit} onCancel={close} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
