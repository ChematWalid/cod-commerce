import { useLingui } from '@lingui/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { PLACEHOLDER_HANDOFF_SESSIONS, TRIAL_BANNER_TEST_ID } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';

/**
 * Where the trial notice shows, above the page and inside the route guard (the provider sorts after it). It holds
 * placeholder text only: no day count or date, which would look like the merchant's real trial.
 * Hand-off: `P9.S1` replaces the text with the trial state.
 */
export function TrialBanner({ children }: PropsWithChildren): ReactNode {
  const { i18n } = useLingui();
  const audience = useShellAudience();
  return (
    <>
      {audience === 'merchant' && (
        <div
          data-testid={TRIAL_BANNER_TEST_ID}
          data-handoff={PLACEHOLDER_HANDOFF_SESSIONS.trialBanner}
          className="bg-muted text-muted-foreground border-b px-4 py-2 text-sm"
        >
          {i18n._('shell.trial-banner.placeholder')}
        </div>
      )}
      {children}
    </>
  );
}
