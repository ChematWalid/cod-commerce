import { useLingui } from '@lingui/react';
import { toast } from '@vendure/dashboard';
import { type ReactNode, type SyntheticEvent, useState } from 'react';
import { BUSINESS_CARD_TEST_ID, BUSINESS_NAME_TEST_ID, BUSINESS_SAVE_TEST_ID } from '../constants';
import { useUpdateBusiness } from '../hooks/use-settings-mutations';
import { settingsErrorMessageId } from '../model/api-error';
import { type BusinessDraft, canSaveBusiness, draftOfBusiness, trimmed } from '../model/settings-form';
import type { BusinessRecord } from '../model/types';
import { SettingsCardFooter } from './settings-card-footer';
import { TextField } from './text-field';

interface BusinessProfileCardProps {
  readonly business: BusinessRecord;
  /** Whether the caller holds `settings.business.edit`; without it the fields only show. */
  readonly canEdit: boolean;
}

/** The business's name. The form restarts from the saved record whenever the record changes. */
function BusinessForm({ business, canEdit }: BusinessProfileCardProps): ReactNode {
  const { i18n } = useLingui();
  const saved = draftOfBusiness(business);
  const [draft, setDraft] = useState<BusinessDraft>(saved);
  const update = useUpdateBusiness();
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!canEdit || !canSaveBusiness(draft, saved)) return;
    update.mutate(trimmed(draft), {
      onSuccess: () => {
        toast.success(i18n._('shell.settings.saved'));
      },
    });
  };
  return (
    <form className="grid max-w-xl gap-4" onSubmit={submit} noValidate>
      <TextField
        data-testid={BUSINESS_NAME_TEST_ID}
        label={i18n._('shell.settings.business.name')}
        value={draft.name}
        readOnly={!canEdit}
        onChange={(event) => {
          setDraft({ name: event.target.value });
        }}
      />
      {canEdit && (
        <SettingsCardFooter
          saveTestId={BUSINESS_SAVE_TEST_ID}
          canSave={canSaveBusiness(draft, saved)}
          saving={update.isPending}
          errorId={update.isError ? settingsErrorMessageId(update.error) : undefined}
        />
      )}
    </form>
  );
}

/** The Business card of General settings (name only: the logo waits for its data). */
export function BusinessProfileCard({ business, canEdit }: BusinessProfileCardProps): ReactNode {
  return (
    <div data-testid={BUSINESS_CARD_TEST_ID}>
      <BusinessForm key={`${business.id}:${business.name}`} business={business} canEdit={canEdit} />
    </div>
  );
}
