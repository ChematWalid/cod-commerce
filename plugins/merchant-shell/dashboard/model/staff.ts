import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';

/** The part of the dashboard user context the shell reads. The stock context has more, so it is assignable to this. */
export interface ShellUserContext {
  readonly administrator: unknown;
  readonly channels: ReadonlyArray<{ readonly permissions: readonly string[] }>;
}

/**
 * Whether the user is a platform employee (D78): holds the PlatformStaff permission on any channel. The active channel
 * is not used: `ctx.hasPermissions` is false while it loads and is scoped to it.
 */
export function isPlatformStaff(ctx: ShellUserContext): boolean {
  return ctx.channels.some((channel) => channel.permissions.includes(PLATFORM_STAFF_PERMISSION));
}

/** Whether the user is a merchant: signed in, so the administrator has loaded, and not platform staff. */
export function isMerchant(ctx: ShellUserContext): boolean {
  return ctx.administrator !== undefined && !isPlatformStaff(ctx);
}
