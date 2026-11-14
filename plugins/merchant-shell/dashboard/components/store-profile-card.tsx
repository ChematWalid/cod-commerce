import { useLingui } from '@lingui/react';
import { Label, Textarea, toast } from '@vendure/dashboard';
import { type ReactNode, type SyntheticEvent, useId, useState } from 'react';
import {
  STORE_CARD_TEST_ID,
  STORE_DESCRIPTION_TEST_ID,
  STORE_LOGO_INPUT_TEST_ID,
  STORE_LOGO_TEST_ID,
  STORE_NAME_TEST_ID,
  STORE_SAVE_TEST_ID,
} from '../constants';
import { useUpdateStore } from '../hooks/use-settings-mutations';
import { settingsErrorMessageId } from '../model/api-error';
import { canSaveStore, draftOfStore, type StoreDraft, storePatchOf } from '../model/settings-form';
import type { StoreRecord } from '../model/types';
import { LogoField } from './logo-field';
import { SettingsCardFooter } from './settings-card-footer';
import { StoreLanguageSelect } from './store-language-select';
import { StoreOperationsFields } from './store-operations-fields';
import { TextField } from './text-field';

interface StoreProfileCardProps {
  readonly store: StoreRecord;
  /** Whether the caller holds `store.settings.edit`; without it the fields only show. */
  readonly canEdit: boolean;
  /**
   * Whether the caller may also upload a logo: the upload needs `settings.business.edit` (D2120). Without it the
   * logo only shows. This gates uploading a new file only; the server lets `updateStore` pick any asset already on
   * the store's channel.
   */
  readonly canUploadLogo: boolean;
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

/** The identity inputs of the card: all read-only unless `canEdit`. */
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

/** The draft of the Store card and its Save, which sends only what changed. */
function useStoreForm(store: StoreRecord, canEdit: boolean) {
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
  return { draft, setDraft, update, canSave, submit };
}

/**
 * The store's logo, name, description, language, address field and sold-out behaviour. The form restarts from the
 * saved record whenever the record changes.
 */
function StoreForm({ store, canEdit, canUploadLogo }: StoreProfileCardProps): ReactNode {
  const { i18n } = useLingui();
  const { draft, setDraft, update, canSave, submit } = useStoreForm(store, canEdit);
  return (
    <form className="grid max-w-xl gap-4" onSubmit={submit} noValidate>
      <LogoField
        label={i18n._('shell.settings.store.logo')}
        currentUrl={store.logoUrl}
        canUpload={canEdit && canUploadLogo}
        imageTestId={STORE_LOGO_TEST_ID}
        inputTestId={STORE_LOGO_INPUT_TEST_ID}
        onUploaded={(logoAssetId) => {
          setDraft((current) => ({ ...current, logoAssetId }));
        }}
      />
      <StoreFields draft={draft} canEdit={canEdit} onChange={setDraft} />
      <StoreOperationsFields
        showAddressField={draft.showAddressField}
        soldOutBehavior={draft.soldOutBehavior}
        disabled={!canEdit}
        onChange={(patch) => {
          setDraft((current) => ({ ...current, ...patch }));
        }}
      />
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

/**
 * The active store's card of General settings (CO-6). The delivery fee group (P3.S1) and the carrier (P5.S1) wait for
 * their data.
 */
export function StoreProfileCard({ store, canEdit, canUploadLogo }: StoreProfileCardProps): ReactNode {
  const savedKey = [
    store.id,
    store.name,
    store.description,
    store.language,
    store.logoAssetId ?? '',
    String(store.showAddressField),
    store.soldOutBehavior,
  ].join(':');
  return (
    <div data-testid={STORE_CARD_TEST_ID}>
      <StoreForm key={savedKey} store={store} canEdit={canEdit} canUploadLogo={canUploadLogo} />
    </div>
  );
}
