import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { Coins } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { CREDITS_PLACEHOLDER_TEST_ID, PLACEHOLDER_HANDOFF_SESSIONS } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';
import { ComingSoonHint } from './coming-soon-hint';

/**
 * The credit balance's place in the top bar. Inert and showing no figure: a number here would look like a real balance.
 * Hand-off: `P9.S2` replaces it with the balance and its top-up flow. Hidden below the `sm` breakpoint.
 */
export function CreditsPlaceholder(): ReactNode {
  const { i18n } = useLingui();
  const audience = useShellAudience();
  const hintId = useId();
  // Platform staff have no credits or assistant: only a merchant's top bar holds them.
  if (audience !== 'merchant') return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        data-testid={CREDITS_PLACEHOLDER_TEST_ID}
        data-handoff={PLACEHOLDER_HANDOFF_SESSIONS.credits}
        aria-describedby={hintId}
        className="hidden gap-2 sm:inline-flex"
      >
        <Coins aria-hidden className="size-4 shrink-0" />
        {i18n._('shell.topbar.credits')}
      </Button>
      <ComingSoonHint id={hintId} />
    </>
  );
}
