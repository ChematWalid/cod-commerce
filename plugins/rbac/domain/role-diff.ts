import type { PermissionKey } from '@cod/shared';

/** The keys an edit adds and removes, as an activity row keeps them. */
export interface PermissionsDiff {
  readonly added: readonly PermissionKey[];
  readonly removed: readonly PermissionKey[];
}

/** What changed between two permission lists, each side sorted. */
export function permissionsDiff(before: readonly PermissionKey[], after: readonly PermissionKey[]): PermissionsDiff {
  const had = new Set(before);
  const has = new Set(after);
  return {
    added: after.filter((key) => !had.has(key)).sort(),
    removed: before.filter((key) => !has.has(key)).sort(),
  };
}

/** Whether the diff changes nothing. */
export const isEmptyDiff = ({ added, removed }: PermissionsDiff): boolean => added.length === 0 && removed.length === 0;
