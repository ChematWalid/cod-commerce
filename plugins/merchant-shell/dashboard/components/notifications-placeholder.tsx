import { useLingui } from '@lingui/react';
import { Alerts, Button } from '@vendure/dashboard';
import { Bell } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { NOTIFICATIONS_PLACEHOLDER_TEST_ID, PLACEHOLDER_HANDOFF_SESSIONS } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';
import { ComingSoonHint } from './coming-soon-hint';

/**
 * The merchant's notification bell. Inert, with no count: a badge here would look like real unread items.
 * Hand-off: `P7.S3` replaces it with the notification list. Platform staff keep the stock alerts.
 */
export function NotificationsPlaceholder(): ReactNode {
  const { i18n } = useLingui();
  const audience = useShellAudience();
  const hintId = useId();
  if (audience === 'staff') return <Alerts />;
  if (audience === 'pending') return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        data-testid={NOTIFICATIONS_PLACEHOLDER_TEST_ID}
        data-handoff={PLACEHOLDER_HANDOFF_SESSIONS.notifications}
        aria-label={i18n._('shell.topbar.notifications')}
        aria-describedby={hintId}
      >
        <Bell aria-hidden />
      </Button>
      <ComingSoonHint id={hintId} />
    </>
  );
}
