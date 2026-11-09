import { useLingui } from '@lingui/react';
import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { fetchAuthPublicConfig } from '../auth-operations';
import { AUTH_PUBLIC_CONFIG_QUERY_KEY, oauthStartPath, REGISTER_PATH } from '../constants';

function OAuthProviders(): ReactNode {
  const { i18n } = useLingui();
  const { data } = useQuery({
    queryKey: AUTH_PUBLIC_CONFIG_QUERY_KEY,
    queryFn: fetchAuthPublicConfig,
    retry: false,
  });
  if (data?.oauthEnabled !== true) return null;
  return data.oauthProviders.map((provider) => (
    <Button
      key={provider}
      variant="outline"
      className="w-full"
      nativeButton={false}
      render={<a href={`${getApiBaseUrl()}${oauthStartPath(provider)}`} />}
    >
      {i18n._('Continue with {provider}', { provider })}
    </Button>
  ));
}

/** Below the stock login form, which is still inside its `<form>`: nothing here may submit it. */
export function LoginAfterForm(): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <OAuthProviders />
      <p className="text-muted-foreground text-sm">
        {i18n._('New here?')}{' '}
        <Link to={REGISTER_PATH} className="text-foreground font-medium underline">
          {i18n._('Create account')}
        </Link>
      </p>
    </div>
  );
}
