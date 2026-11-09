import {
  type AreaLevel,
  type AreaLevelChoice,
  expandRolePermissions,
  isPermissionKey,
  PERMISSION_AREA_IDS,
  type PermissionArea,
  type PermissionKey,
  ROLE_DESCRIPTION_MAX_LENGTH,
  UnknownAreaLevelError,
  UnknownPermissionError,
} from '@cod/shared';
import { RoleDescriptionTooLongError } from './errors';

/** The role editor's choices as a client sends them (D63); the server expands them. */
export interface RolePermissionChoices {
  readonly areaLevels: readonly { readonly area: string; readonly level: string }[];
  readonly grants: readonly string[];
  readonly revokes: readonly string[];
}

const LEVELS: readonly string[] = ['none', 'view', 'full'] satisfies AreaLevel[];
const isArea = (value: string): value is PermissionArea => (PERMISSION_AREA_IDS as readonly string[]).includes(value);
const isLevel = (value: string): value is AreaLevel => LEVELS.includes(value);

function parseChoice({ area, level }: RolePermissionChoices['areaLevels'][number]): AreaLevelChoice {
  if (!isArea(area)) throw new UnknownPermissionError(area);
  if (!isLevel(level)) throw new UnknownAreaLevelError(level);
  return { area, level };
}

function parseKey(key: string): PermissionKey {
  if (!isPermissionKey(key)) throw new UnknownPermissionError(key);
  return key;
}

/**
 * The permissions of a role from its base and the editor's choices (D63). A client never names a list directly.
 *
 * @throws {@link UnknownPermissionError} or {@link UnknownAreaLevelError} for anything outside the catalog
 */
export function resolvePermissions(base: readonly PermissionKey[], choices: RolePermissionChoices): PermissionKey[] {
  return expandRolePermissions({
    base,
    areaLevels: choices.areaLevels.map(parseChoice),
    grants: choices.grants.map(parseKey),
    revokes: choices.revokes.map(parseKey),
  });
}

/**
 * A description as kept: trimmed, and blank means none.
 *
 * @throws {@link RoleDescriptionTooLongError} over the limit (D71)
 */
export function parseDescription(raw: string | null | undefined): string | null {
  const description = raw?.normalize('NFKC').trim() ?? '';
  if (Array.from(description).length > ROLE_DESCRIPTION_MAX_LENGTH) throw new RoleDescriptionTooLongError();
  return description === '' ? null : description;
}
