import { ASSISTANT_NAME } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { ASSISTANT_PLACEHOLDER_TEST_ID, PLACEHOLDER_HANDOFF_SESSIONS } from '../constants';

/**
 * The assistant's entry in the top bar, named by `ASSISTANT_NAME`. Inert: no chat opens and nothing is requested.
 * Hand-off: `P9.S7a` replaces it with the assistant panel. Hidden below the `sm` breakpoint.
 */
export function AssistantPlaceholder(): ReactNode {
  const { i18n } = useLingui();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      data-testid={ASSISTANT_PLACEHOLDER_TEST_ID}
      data-handoff={PLACEHOLDER_HANDOFF_SESSIONS.assistant}
      title={i18n._('shell.topbar.coming-soon')}
      className="hidden gap-2 sm:inline-flex"
    >
      <Sparkles aria-hidden className="size-4 shrink-0" />
      {ASSISTANT_NAME}
    </Button>
  );
}
