import { useLingui } from '@lingui/react';
import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { fetchAuthPublicConfig } from '../auth-operations';
import { AUTH_PUBLIC_CONFIG_QUERY_KEY, oauthProviderLabel, oauthStartPath } from '../constants';

/** One link per provider on offer, and nothing at all while the OAuth flag is off (D36). */
export function OAuthProviderButtons(): ReactNode {
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
      {i18n._('Continue with {provider}', { provider: oauthProviderLabel(provider) })}
    </Button>
  ));
}
