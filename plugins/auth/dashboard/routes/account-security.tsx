import { emailSchema, passwordSchema } from '@cod/shared';
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
import type { ReactNode } from 'react';
import { changeAccountPassword, fetchAccountStatus, requestEmailChange } from '../auth-operations';
import { TextField } from '../components/text-field';
import {
  ACCOUNT_SECURITY_PATH,
  ACCOUNT_STATUS_QUERY_KEY,
  PASSWORDS_DIFFER_MESSAGE_ID,
  REQUIRED_FIELD_MESSAGE_ID,
} from '../constants';
import type { FieldErrors } from '../field-errors';
import { useAccountForm } from '../hooks/use-account-form';

const PAGE_ID = 'auth-account-security';
const PASSWORD_BLOCK_ID = 'auth-change-password';
const EMAIL_BLOCK_ID = 'auth-change-email';
const SECURITY_TITLE = 'Security';
const POLICY_MESSAGE_ID = 'auth.password-policy';
const EMAIL_INVALID_MESSAGE_ID = 'auth.email-invalid';
const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmation: '' };
const EMPTY_EMAIL_CHANGE = { newEmail: '', currentPassword: '' };

function passwordErrors({ currentPassword, newPassword, confirmation }: typeof EMPTY_PASSWORDS): FieldErrors {
  return {
    ...(currentPassword === '' && { currentPassword: REQUIRED_FIELD_MESSAGE_ID }),
    ...(!passwordSchema.safeParse(newPassword).success && { newPassword: POLICY_MESSAGE_ID }),
    ...(newPassword !== confirmation && { confirmation: PASSWORDS_DIFFER_MESSAGE_ID }),
  };
}

function emailChangeErrors({ newEmail, currentPassword }: typeof EMPTY_EMAIL_CHANGE): FieldErrors {
  return {
    ...(!emailSchema.safeParse(newEmail).success && { newEmail: EMAIL_INVALID_MESSAGE_ID }),
    ...(currentPassword === '' && { currentPassword: REQUIRED_FIELD_MESSAGE_ID }),
  };
}

function ChangePasswordForm(): ReactNode {
  const { i18n } = useLingui();
  const { field, submit, saving } = useAccountForm({
    initial: EMPTY_PASSWORDS,
    validate: passwordErrors,
    passwordField: 'currentPassword',
    save: async ({ currentPassword, newPassword }) => {
      await changeAccountPassword(currentPassword, newPassword);
      toast.success(i18n._('Password changed'));
      return EMPTY_PASSWORDS;
    },
  });
  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      <TextField
        label={i18n._('Current password')}
        isPassword
        autoComplete="current-password"
        {...field('currentPassword')}
      />
      <TextField
        label={i18n._('New password')}
        isPassword
        autoComplete="new-password"
        hint={i18n._('At least 8 characters')}
        {...field('newPassword')}
      />
      <TextField
        label={i18n._('Confirm new password')}
        isPassword
        autoComplete="new-password"
        {...field('confirmation')}
      />
      <Button type="submit" className="justify-self-start" disabled={saving}>
        {i18n._('Change password')}
      </Button>
    </form>
  );
}

function ChangeEmailForm(): ReactNode {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ACCOUNT_STATUS_QUERY_KEY, queryFn: fetchAccountStatus, retry: false });
  const { field, submit, saving } = useAccountForm({
    initial: EMPTY_EMAIL_CHANGE,
    validate: emailChangeErrors,
    passwordField: 'currentPassword',
    save: async ({ newEmail, currentPassword }) => {
      await requestEmailChange(newEmail, currentPassword);
      toast.success(i18n._('Check your new inbox to confirm the change'));
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_STATUS_QUERY_KEY });
      return EMPTY_EMAIL_CHANGE;
    },
  });
  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      {data?.pendingEmail != null && (
        <p className="text-sm" role="status">
          {i18n._('Waiting for confirmation: {email}', { email: data.pendingEmail })}
        </p>
      )}
      <TextField label={i18n._('New email')} type="email" dir="ltr" autoComplete="email" {...field('newEmail')} />
      <TextField
        label={i18n._('Current password')}
        isPassword
        autoComplete="current-password"
        {...field('currentPassword')}
      />
      <Button type="submit" className="justify-self-start" disabled={saving}>
        {i18n._('Change email')}
      </Button>
    </form>
  );
}

function AccountSecurityPage(): ReactNode {
  const { i18n } = useLingui();
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(SECURITY_TITLE)}</PageTitle>
      <PageLayout>
        <PageBlock column="main" blockId={PASSWORD_BLOCK_ID} title={i18n._('Change password')}>
          <ChangePasswordForm />
        </PageBlock>
        <PageBlock column="main" blockId={EMAIL_BLOCK_ID} title={i18n._('Change email')}>
          <ChangeEmailForm />
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

/** Password and email changes of the signed-in account (D38). */
export const accountSecurityRoute: DashboardRouteDefinition = {
  path: ACCOUNT_SECURITY_PATH,
  component: () => <AccountSecurityPage />,
};
