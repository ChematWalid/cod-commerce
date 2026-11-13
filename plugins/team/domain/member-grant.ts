import type { Snowflake, StoreAccessKind } from '@cod/shared';

/**
 * Roles and stores a member is to hold, kept by Team only while rbac does not hold them: on an open invitation, or
 * as the snapshot of a deactivated member (D204). rbac is the source of truth for every other member.
 */
export interface MemberGrant {
  readonly roleIds: readonly Snowflake[];
  readonly storeAccess: StoreAccessKind;
  readonly storeIds: readonly Snowflake[];
}

/** The store access a clear names: a {@link MemberGrant} without roles (D804). */
export type MemberStoreGrant = Omit<MemberGrant, 'roleIds'>;
