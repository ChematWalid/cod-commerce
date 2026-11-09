import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { Coins } from 'lucide-react';
import type { ReactNode } from 'react';
import { CREDITS_PLACEHOLDER_TEST_ID, PLACEHOLDER_HANDOFF_SESSIONS } from '../constants';

/**
 * The credit balance's place in the top bar. Inert and showing no figure: a number here would look like a real balance.
 * Hand-off: `P9.S2` replaces it with the balance and its top-up flow. Hidden below the `sm` breakpoint.
 */
export function CreditsPlaceholder(): ReactNode {
  const { i18n } = useLingui();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      data-testid={CREDITS_PLACEHOLDER_TEST_ID}
      data-handoff={PLACEHOLDER_HANDOFF_SESSIONS.credits}
      title={i18n._('shell.topbar.coming-soon')}
      className="hidden gap-2 sm:inline-flex"
    >
      <Coins aria-hidden className="size-4 shrink-0" />
      {i18n._('shell.topbar.credits')}
    </Button>
  );
}
