import { useLingui } from '@lingui/react';
import type { AnyRoute } from '@tanstack/react-router';
import type { DashboardRouteDefinition } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { confirmEmailChange } from '../auth-operations';
import { PublicPageFrame } from '../components/public-page-frame';
import { TokenConfirmCard } from '../components/token-confirm-card';
import { CONFIRM_EMAIL_CHANGE_PATH } from '../constants';
import { useLinkToken, validateTokenSearch } from './token-search';

function ConfirmEmailChangePage({ route }: { readonly route: AnyRoute }): ReactNode {
  const { i18n } = useLingui();
  const token = useLinkToken(route);
  return (
    <PublicPageFrame>
      <TokenConfirmCard
        token={token}
        title={i18n._('Confirm your new email')}
        explanation={i18n._('Use this address to sign in from now on.')}
        actionLabel={i18n._('Confirm new email')}
        successMessage={i18n._('Your email address has been changed')}
        confirm={confirmEmailChange}
      />
    </PublicPageFrame>
  );
}

/** The page an emailed address-change link opens. */
export const confirmEmailChangeRoute: DashboardRouteDefinition = {
  path: CONFIRM_EMAIL_CHANGE_PATH,
  authenticated: false,
  validateSearch: validateTokenSearch,
  component: (route) => <ConfirmEmailChangePage route={route} />,
};
