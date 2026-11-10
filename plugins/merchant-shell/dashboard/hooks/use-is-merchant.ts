import { useAuth } from '@vendure/dashboard';
import { isMerchant, isPlatformStaff } from '../model/staff';

/** Who the shell treats the signed-in user as; `pending` until the administrator has loaded. */
export type ShellAudience = 'pending' | 'merchant' | 'staff';

/** Reads the audience from the same session the sidebar's `isVisible` uses (D78). */
export function useShellAudience(): ShellAudience {
  const { user, channels } = useAuth();
  const context = { administrator: user, channels: channels ?? [] };
  if (isPlatformStaff(context)) return 'staff';
  return isMerchant(context) ? 'merchant' : 'pending';
}
