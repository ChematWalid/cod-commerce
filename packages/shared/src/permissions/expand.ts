import { DomainError } from '../errors/domain-error';
import type { PermissionArea } from './areas';
import { PERMISSION_CATALOG, isPermissionKey, type PermissionKey } from './catalog';
import { RBAC_ERROR_CODES } from './error-codes';
import type { AreaLevel } from './types';

/** Thrown when an input names a key that is not in the catalog. */
export class UnknownPermissionError extends DomainError {
  readonly code = RBAC_ERROR_CODES.UNKNOWN_PERMISSION;
  readonly key: string;

  constructor(key: string) {
    super(`Unknown permission key: ${key}`);
    this.key = key;
  }
}

/** Thrown when an area level is not `none`, `view` or `full`. */
export class UnknownAreaLevelError extends DomainError {
  readonly code = RBAC_ERROR_CODES.UNKNOWN_PERMISSION;
  readonly level: string;

  constructor(level: string) {
    super(`Unknown area level: ${level}`);
    this.level = level;
  }
}

/** The level chosen for one area. */
export interface AreaLevelChoice {
  readonly area: PermissionArea;
  readonly level: AreaLevel;
}

/** Input of {@link expandRolePermissions} (D63). */
export interface ExpandRoleInput {
  readonly base: readonly PermissionKey[];
  readonly areaLevels: readonly AreaLevelChoice[];
  readonly grants: readonly PermissionKey[];
  readonly revokes: readonly PermissionKey[];
}

const keysOfArea = (area: PermissionArea): PermissionKey[] =>
  PERMISSION_CATALOG.filter((entry) => entry.area === area).map((entry) => entry.key);

/** Keys an area's "View" level grants: view-level and not sensitive (D62). */
const viewKeysOfArea = (area: PermissionArea): PermissionKey[] =>
  PERMISSION_CATALOG.filter((entry) => entry.area === area && entry.level === 'view' && !entry.sensitive).map(
    (entry) => entry.key,
  );

const keysForLevel = (area: PermissionArea, level: AreaLevel): PermissionKey[] => {
  switch (level) {
    case 'none':
      return [];
    case 'view':
      return viewKeysOfArea(area);
    case 'full':
      return keysOfArea(area);
    default:
      throw new UnknownAreaLevelError(String(level));
  }
};

function assertKnown(keys: readonly string[]): void {
  for (const key of keys) if (!isPermissionKey(key)) throw new UnknownPermissionError(key);
}

/**
 * Turns the role editor's choices into a permission list: start from `base`, replace
 * each named area by its level, add `grants`, then remove `revokes`. Sorted and unique.
 * Throws {@link UnknownPermissionError} for a key outside the catalog.
 */
export function expandRolePermissions(input: ExpandRoleInput): PermissionKey[] {
  assertKnown([...input.base, ...input.grants, ...input.revokes]);
  const held = new Set<PermissionKey>(input.base);
  for (const { area, level } of input.areaLevels) {
    for (const key of keysOfArea(area)) held.delete(key);
    for (const key of keysForLevel(area, level)) held.add(key);
  }
  for (const key of input.grants) held.add(key);
  for (const key of input.revokes) held.delete(key);
  return [...held].sort();
}

const sameKeys = (held: ReadonlySet<string>, expected: readonly string[]): boolean =>
  held.size === expected.length && expected.every((key) => held.has(key));

/** The level an area is at for a permission list, or `custom` when it matches none. */
export function areaLevelOf(area: PermissionArea, permissions: readonly PermissionKey[]): AreaLevel | 'custom' {
  const inArea = new Set(keysOfArea(area));
  const held = new Set(permissions.filter((key) => inArea.has(key)));
  if (held.size === 0) return 'none';
  if (sameKeys(held, [...inArea])) return 'full';
  return sameKeys(held, viewKeysOfArea(area)) ? 'view' : 'custom';
}
