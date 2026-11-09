import {
  type AreaLevel,
  areaLevelOf,
  type BuiltInRoleKey,
  PERMISSION_AREA_IDS,
  type PermissionArea,
  type PermissionKey,
  type Snowflake,
} from '@cod/shared';
import type { BusinessRole } from './business-role';

/** A role as clients read it; levels and counts are the server's answers, never computed in a frontend (ADR 0017). */
export interface BusinessRoleView {
  readonly id: Snowflake;
  readonly name: string;
  readonly description: string | null;
  readonly builtInKey: BuiltInRoleKey | null;
  readonly isBuiltIn: boolean;
  readonly permissions: readonly PermissionKey[];
  readonly areaLevels: readonly { readonly area: PermissionArea; readonly level: AreaLevel | 'custom' }[];
  readonly permissionCount: number;
  readonly memberCount: number;
  readonly updatedAt: Date;
}

/** The view of a role held by `memberCount` members. */
export function toRoleView(role: BusinessRole, memberCount: number): BusinessRoleView {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    builtInKey: role.builtInKey,
    isBuiltIn: role.builtInKey !== null,
    permissions: role.permissions,
    areaLevels: PERMISSION_AREA_IDS.map((area) => ({ area, level: areaLevelOf(area, role.permissions) })),
    permissionCount: role.permissions.length,
    memberCount,
    updatedAt: role.updatedAt,
  };
}
