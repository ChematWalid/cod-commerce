import { useLingui } from '@lingui/react';
import { Label, Textarea, toast } from '@vendure/dashboard';
import { type ReactNode, type SyntheticEvent, useId, useState } from 'react';
import { STORE_CARD_TEST_ID, STORE_DESCRIPTION_TEST_ID, STORE_NAME_TEST_ID, STORE_SAVE_TEST_ID } from '../constants';
import { useUpdateStore } from '../hooks/use-settings-mutations';
import { settingsErrorMessageId } from '../model/api-error';
import { canSaveStore, draftOfStore, type StoreDraft, storePatchOf } from '../model/settings-form';
import type { StoreRecord } from '../model/types';
import { SettingsCardFooter } from './settings-card-footer';
import { StoreLanguageSelect } from './store-language-select';
import { TextField } from './text-field';

interface StoreProfileCardProps {
  readonly store: StoreRecord;
  /** Whether the caller holds `store.settings.edit`; without it the fields only show. */
  readonly canEdit: boolean;
}

function DescriptionField({
  value,
  readOnly,
  onChange,
}: {
  readonly value: string;
  readonly readOnly: boolean;
  readonly onChange: (value: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('shell.settings.store.description')}</Label>
      <Textarea
        id={id}
        data-testid={STORE_DESCRIPTION_TEST_ID}
        rows={4}
        value={value}
        readOnly={readOnly}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/** The three inputs of the card: all read-only unless `canEdit`. */
function StoreFields({
  draft,
  canEdit,
  onChange,
}: {
  readonly draft: StoreDraft;
  readonly canEdit: boolean;
  readonly onChange: (draft: StoreDraft) => void;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <TextField
        data-testid={STORE_NAME_TEST_ID}
        label={i18n._('shell.settings.store.name')}
        value={draft.name}
        readOnly={!canEdit}
        onChange={(event) => {
          onChange({ ...draft, name: event.target.value });
        }}
      />
      <DescriptionField
        value={draft.description}
        readOnly={!canEdit}
        onChange={(description) => {
          onChange({ ...draft, description });
        }}
      />
      <StoreLanguageSelect
        value={draft.language}
        disabled={!canEdit}
        onChange={(language) => {
          onChange({ ...draft, language });
        }}
      />
    </>
  );
}

/** The store's name, description and language. The form restarts from the saved record whenever the record changes. */
function StoreForm({ store, canEdit }: StoreProfileCardProps): ReactNode {
  const { i18n } = useLingui();
  const saved = draftOfStore(store);
  const [draft, setDraft] = useState<StoreDraft>(saved);
  const update = useUpdateStore(store.id);
  const canSave = canSaveStore(draft, saved);
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!canEdit || !canSave) return;
    update.mutate(storePatchOf(draft, saved), {
      onSuccess: () => {
        toast.success(i18n._('shell.settings.saved'));
      },
    });
  };
  return (
    <form className="grid max-w-xl gap-4" onSubmit={submit} noValidate>
      <StoreFields draft={draft} canEdit={canEdit} onChange={setDraft} />
      {canEdit && (
        <SettingsCardFooter
          saveTestId={STORE_SAVE_TEST_ID}
          canSave={canSave}
          saving={update.isPending}
          errorId={update.isError ? settingsErrorMessageId(update.error) : undefined}
        />
      )}
    </form>
  );
}

/** The active store's card of General settings. Logo, delivery fee group, carrier and address field wait for their data. */
export function StoreProfileCard({ store, canEdit }: StoreProfileCardProps): ReactNode {
  return (
    <div data-testid={STORE_CARD_TEST_ID}>
      <StoreForm
        key={`${store.id}:${store.name}:${store.description}:${store.language}`}
        store={store}
        canEdit={canEdit}
      />
    </div>
  );
}
