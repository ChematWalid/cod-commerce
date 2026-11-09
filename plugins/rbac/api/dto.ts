import type { RolePermissionChoices } from '../domain/role-input';

/** One area and its level as the editor sends it. */
export interface AreaLevelInputDto {
  readonly area: string;
  readonly level: string;
}

interface RoleChoicesDto {
  readonly startFromRoleId?: string | null;
  readonly areaLevels?: readonly AreaLevelInputDto[] | null;
  readonly grants?: readonly string[] | null;
  readonly revokes?: readonly string[] | null;
}

/** The `CreateBusinessRoleInput` GraphQL input. */
export interface CreateBusinessRoleInputDto extends RoleChoicesDto {
  readonly name: string;
  readonly description?: string | null;
}

/** The `UpdateBusinessRoleInput` GraphQL input. */
export interface UpdateBusinessRoleInputDto extends RoleChoicesDto {
  readonly name?: string | null;
  readonly description?: string | null;
}

/** The editor's choices of an input, absent ones empty. */
export const choicesOf = (input: RoleChoicesDto): RolePermissionChoices => ({
  areaLevels: input.areaLevels ?? [],
  grants: input.grants ?? [],
  revokes: input.revokes ?? [],
});
