import type { BuiltInRoleDefinition, BuiltInRoleKey, PermissionKey, Snowflake } from '@cod/shared';
import type { BindingScope, MemberStoreAccess } from './constants';
import { parseRoleName } from './role-name';

/** A role of a business: a built-in, or one the merchant made. */
export interface BusinessRole {
  readonly id: Snowflake;
  readonly name: string;
  readonly nameKey: string;
  readonly description: string | null;
  readonly builtInKey: BuiltInRoleKey | null;
  readonly permissions: readonly PermissionKey[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** One Vendure Role projecting a business role on a scope (D53). */
export interface RoleBinding {
  readonly id: Snowflake;
  readonly businessRoleId: Snowflake;
  readonly scope: BindingScope;
  readonly vendureRoleId: number;
}

/** A member holding a role, on all stores or on selected ones (D54). */
export interface MemberAssignment {
  readonly id: Snowflake;
  readonly administratorId: number;
  readonly businessRoleId: Snowflake;
  readonly storeAccess: MemberStoreAccess;
  readonly storeIds: readonly Snowflake[];
  readonly createdAt: Date;
}

/** The row of a built-in template. Its stored name is the English label, whose key reserves that name (D71). */
export function newBuiltInRole(template: BuiltInRoleDefinition, id: Snowflake, now: Date): BusinessRole {
  return {
    id,
    ...parseRoleName(template.label.en),
    description: template.description.en,
    builtInKey: template.key,
    permissions: template.permissions,
    createdAt: now,
    updatedAt: now,
  };
}
