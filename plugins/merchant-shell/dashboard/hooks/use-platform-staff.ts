import { useShellAudience } from './use-is-merchant';

/**
 * Whether the signed-in user is a platform employee (D78). A staff-only page reads it to show the shell's not-found
 * page to anyone else; the route guard renders nothing until the audience is known, so `false` never means "loading".
 * Presentation only: the server refuses the data.
 */
export function usePlatformStaff(): boolean {
  return useShellAudience() === 'staff';
}
