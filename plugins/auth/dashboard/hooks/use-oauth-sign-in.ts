import { LS_KEY_SELECTED_CHANNEL_TOKEN } from '@/vdb/constants.js';
import { useAuth, useUserSettings } from '@vendure/dashboard';
import { authenticateWithOAuthTicket } from '../auth-operations';

/**
 * Spends a sign-in ticket. Selects the account's channel before the session is refreshed, as `useAuth().login` does:
 * a browser still holding another account's channel would otherwise land on `FORBIDDEN` (Review Focus 5).
 */
export function useOAuthSignIn(): (ticket: string) => Promise<void> {
  const auth = useAuth();
  const { setActiveChannelId } = useUserSettings();
  return async (ticket) => {
    const channels = await authenticateWithOAuthTicket(ticket);
    const channel = channels[0];
    if (channel !== undefined) {
      localStorage.setItem(LS_KEY_SELECTED_CHANNEL_TOKEN, channel.token);
      setActiveChannelId(channel.id);
    }
    auth.refreshCurrentUser();
  };
}
