import {
  type AreaLevel,
  expandRolePermissions,
  PERMISSION_CATALOG,
  type PermissionArea,
  type PermissionKey,
} from '@cod/shared';

/** The role editor's choices. The server expands the same choices authoritatively (D63); this preview is feedback. */
export interface RoleDraft {
  /** What "no start role" means: nothing on create, the role's own permissions on edit. */
  readonly originalBase: readonly PermissionKey[];
  readonly base: readonly PermissionKey[];
  readonly startFromRoleId: string | null;
  readonly areaLevels: ReadonlyMap<PermissionArea, AreaLevel>;
  /** Keys the user switched away from what the base and levels give: `true` grants, `false` revokes. */
  readonly toggles: ReadonlyMap<PermissionKey, boolean>;
}

/** The permission part of a create or update input; never a permission list (ADR 0017). */
export interface RoleChoicesInput {
  readonly startFromRoleId?: string;
  readonly areaLevels: readonly { readonly area: PermissionArea; readonly level: AreaLevel }[];
  readonly grants: readonly PermissionKey[];
  readonly revokes: readonly PermissionKey[];
}

const keysWithToggle = (draft: RoleDraft, on: boolean): PermissionKey[] =>
  [...draft.toggles].filter(([, value]) => value === on).map(([key]) => key);

/** A draft with nothing chosen yet, over `base`. */
export function emptyDraft(base: readonly PermissionKey[]): RoleDraft {
  return { originalBase: base, base, startFromRoleId: null, areaLevels: new Map(), toggles: new Map() };
}

/** What the role would hold, by the rule the server applies. */
export function previewOf(draft: RoleDraft): PermissionKey[] {
  return expandRolePermissions({
    base: draft.base,
    areaLevels: [...draft.areaLevels].map(([area, level]) => ({ area, level })),
    grants: keysWithToggle(draft, true),
    revokes: keysWithToggle(draft, false),
  });
}

/** Picks the role to start from, or none, and drops the earlier choices, which were made against another base. */
export function withStartFrom(
  draft: RoleDraft,
  role: { readonly id: string; readonly permissions: readonly PermissionKey[] } | null,
): RoleDraft {
  return {
    ...draft,
    base: role?.permissions ?? draft.originalBase,
    startFromRoleId: role?.id ?? null,
    areaLevels: new Map(),
    toggles: new Map(),
  };
}

/** Sets an area's level; the level replaces the area, so the toggles inside it no longer apply. */
export function withAreaLevel(draft: RoleDraft, area: PermissionArea, level: AreaLevel): RoleDraft {
  const inArea = new Set<PermissionKey>(
    PERMISSION_CATALOG.filter((entry) => entry.area === area).map((entry) => entry.key),
  );
  return {
    ...draft,
    areaLevels: new Map(draft.areaLevels).set(area, level),
    toggles: new Map([...draft.toggles].filter(([key]) => !inArea.has(key))),
  };
}

/** Switches one permission; a switch back to what the base and levels give is no longer a choice. */
export function withPermission(draft: RoleDraft, key: PermissionKey, on: boolean): RoleDraft {
  const toggles = new Map(draft.toggles);
  toggles.delete(key);
  const heldWithout = previewOf({ ...draft, toggles }).includes(key);
  if (heldWithout !== on) toggles.set(key, on);
  return { ...draft, toggles };
}

/** The choices as the API takes them. */
export function roleInputOf(draft: RoleDraft): RoleChoicesInput {
  return {
    ...(draft.startFromRoleId !== null && { startFromRoleId: draft.startFromRoleId }),
    areaLevels: [...draft.areaLevels].map(([area, level]) => ({ area, level })),
    grants: keysWithToggle(draft, true),
    revokes: keysWithToggle(draft, false),
  };
}
