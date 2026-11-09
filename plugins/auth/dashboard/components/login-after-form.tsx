import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { REGISTER_PATH } from '../constants';
import { OAuthProviderButtons } from './oauth-provider-buttons';

/** Below the stock login form, which is still inside its `<form>`: nothing here may submit it. */
export function LoginAfterForm(): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <OAuthProviderButtons />
      <p className="text-muted-foreground text-sm">
        {i18n._('New here?')}{' '}
        <Link to={REGISTER_PATH} className="text-foreground font-medium underline">
          {i18n._('Create account')}
        </Link>
      </p>
    </div>
  );
}
