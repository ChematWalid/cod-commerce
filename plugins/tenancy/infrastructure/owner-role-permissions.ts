import type { Permission, PermissionDefinition } from '@vendure/core';
import { PLATFORM_ONLY_CUSTOM_PERMISSIONS } from '../domain/constants';

/**
 * Every assignable plugin permission except the platform's own, which is what an Owner role holds. Never a core one
 * such as `ReadChannel` (A1).
 */
export function ownerRolePermissions(customPermissions: readonly PermissionDefinition[]): Permission[] {
  return (
    customPermissions
      .flatMap((definition) => definition.getMetadata())
      .filter(({ assignable, name }) => assignable && !PLATFORM_ONLY_CUSTOM_PERMISSIONS.includes(name))
      // Custom permissions extend the enum at runtime only, so the compiler cannot know these names.
      .map(({ name }) => name as unknown as Permission)
  );
}
