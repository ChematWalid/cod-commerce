import { type PermissionKey, vendurePermissionName } from '@cod/shared';

/** A channel of the session and the permissions it grants, as `me.channels` holds them. */
export interface ChannelPermissions {
  readonly id: string;
  readonly permissions: readonly string[];
}

/**
 * Whether `channelId`'s role grants `key`. Presentation only: the server checks the same key again on every call
 * (ADR 0017). False while the session or the channel is unknown.
 */
export function channelHolds(
  channels: readonly ChannelPermissions[] | undefined,
  channelId: string | undefined,
  key: PermissionKey,
): boolean {
  const channel = channels?.find(({ id }) => id === channelId);
  return channel?.permissions.includes(vendurePermissionName(key)) ?? false;
}
