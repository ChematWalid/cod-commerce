import { updateAccountProfileSchema } from '@cod/shared';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  type DashboardRouteDefinition,
  Page,
  PageBlock,
  PageLayout,
  PageTitle,
  toast,
} from '@vendure/dashboard';
import { CURRENT_ADMINISTRATOR_AVATAR_QUERY_KEY } from '@/vdb/providers/auth.js';
import type { ReactNode } from 'react';
import {
  type AccountProfileDto,
  fetchAccountProfile,
  setAccountAvatar,
  updateAccountProfile,
} from '../auth-operations';
import { LogoPicker } from '../components/logo-picker';
import { ACCOUNT_PROFILE_PATH, ACCOUNT_PROFILE_QUERY_KEY } from '../constants';
import { errorMessageId } from '../error-messages';
import { fieldErrorsOf } from '../field-errors';
import { useAccountForm } from '../hooks/use-account-form';

const PAGE_ID = 'auth-account-profile';
const BLOCK_ID = 'auth-account-profile-form';
const PROFILE_TITLE = 'Profile';

function PhotoField({ avatarUrl }: { readonly avatarUrl: string | null }): ReactNode {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const onChange = async (file: File | null): Promise<void> => {
    try {
      await setAccountAvatar(file);
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_PROFILE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: CURRENT_ADMINISTRATOR_AVATAR_QUERY_KEY });
    } catch (error: unknown) {
      toast.error(i18n._(errorMessageId(error)));
    }
  };
  return (
    <LogoPicker
      label={i18n._('Photo')}
      hint={i18n._('PNG, JPEG, GIF or WebP, up to 5 MB')}
      file={null}
      currentUrl={avatarUrl}
      onChange={(file) => void onChange(file)}
    />
  );
}

function ProfileForm({ profile }: { readonly profile: AccountProfileDto }): ReactNode {
  const { i18n } = useLingui();
  const { field, submit, saving } = useAccountForm({
    initial: { firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone ?? '' },
    validate: (values) => fieldErrorsOf(updateAccountProfileSchema, values),
    save: async (values) => {
      const saved = await updateAccountProfile(values);
      toast.success(i18n._('Profile saved'));
      return { firstName: saved.firstName, lastName: saved.lastName, phone: saved.phone ?? '' };
    },
  });
  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      <TextField label={i18n._('First name')} autoComplete="given-name" {...field('firstName')} />
      <TextField label={i18n._('Last name')} autoComplete="family-name" {...field('lastName')} />
      <TextField label={i18n._('Phone')} type="tel" dir="ltr" autoComplete="tel" {...field('phone')} />
      <TextField label={i18n._('Email')} dir="ltr" value={profile.emailAddress} readOnly disabled />
      <Button type="submit" className="justify-self-start" disabled={saving}>
        {i18n._('Save')}
      </Button>
    </form>
  );
}

function AccountProfilePage(): ReactNode {
  const { i18n } = useLingui();
  const { data, isError } = useQuery({
    queryKey: ACCOUNT_PROFILE_QUERY_KEY,
    queryFn: fetchAccountProfile,
    retry: false,
  });
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(PROFILE_TITLE)}</PageTitle>
      <PageLayout>
        <PageBlock column="main" blockId={BLOCK_ID}>
          {isError && <p role="alert">{i18n._('Something went wrong. Please try again.')}</p>}
          {data !== undefined && (
            <div className="grid gap-6">
              <PhotoField avatarUrl={data.avatarUrl} />
              <ProfileForm key={data.emailAddress} profile={data} />
            </div>
          )}
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

/** Photo, names and phone of the signed-in account (D38). */
export const accountProfileRoute: DashboardRouteDefinition = {
  path: ACCOUNT_PROFILE_PATH,
  component: () => <AccountProfilePage />,
};
