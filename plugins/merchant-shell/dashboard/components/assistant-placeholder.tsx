import { ASSISTANT_NAME } from '@cod/shared';
import { Button } from '@vendure/dashboard';
import { Sparkles } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { ASSISTANT_PLACEHOLDER_TEST_ID, PLACEHOLDER_HANDOFF_SESSIONS } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';
import { ComingSoonHint } from './coming-soon-hint';

/**
 * The assistant's entry in the top bar, named by `ASSISTANT_NAME`. Inert: no chat opens and nothing is requested.
 * Hand-off: `P9.S7a` replaces it with the assistant panel. Hidden below the `sm` breakpoint.
 */
export function AssistantPlaceholder(): ReactNode {
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
        data-testid={ASSISTANT_PLACEHOLDER_TEST_ID}
        data-handoff={PLACEHOLDER_HANDOFF_SESSIONS.assistant}
        aria-describedby={hintId}
        className="hidden gap-2 sm:inline-flex"
      >
        <Sparkles aria-hidden className="size-4 shrink-0" />
        {ASSISTANT_NAME}
      </Button>
      <ComingSoonHint id={hintId} />
    </>
  );
}
