import { useLingui } from '@lingui/react';
import type { AnyRoute } from '@tanstack/react-router';
import type { DashboardRouteDefinition } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { verifyEmail } from '../auth-operations';
import { PublicPageFrame } from '../components/public-page-frame';
import { TokenConfirmCard } from '../components/token-confirm-card';
import { VERIFY_EMAIL_PATH } from '../constants';
import { useLinkToken, validateTokenSearch } from './token-search';

function VerifyEmailPage({ route }: { readonly route: AnyRoute }): ReactNode {
  const { i18n } = useLingui();
  const token = useLinkToken(route);
  return (
    <PublicPageFrame>
      <TokenConfirmCard
        token={token}
        title={i18n._('Verify your email')}
        explanation={i18n._('Confirm that this email address is yours.')}
        actionLabel={i18n._('Verify my email')}
        successMessage={i18n._('Your email is verified')}
        confirm={verifyEmail}
      />
    </PublicPageFrame>
  );
}

/** The page an emailed verification link opens. */
export const verifyEmailRoute: DashboardRouteDefinition = {
  path: VERIFY_EMAIL_PATH,
  authenticated: false,
  validateSearch: validateTokenSearch,
  component: (route) => <VerifyEmailPage route={route} />,
};
