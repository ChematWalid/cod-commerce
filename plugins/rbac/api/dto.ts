import type { CreateRoleCommand } from '../application/create-role.service';
import type { UpdateRoleCommand } from '../application/update-role.service';
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

/** The use-case command of a create input; GraphQL and REST both build it here. */
export const createCommandOf = (input: CreateBusinessRoleInputDto): CreateRoleCommand => ({
  ...choicesOf(input),
  name: input.name,
  description: input.description ?? null,
  startFromRoleId: input.startFromRoleId ?? null,
});

/** The use-case command of an update input; only what is sent changes. */
export const updateCommandOf = (id: string, input: UpdateBusinessRoleInputDto): UpdateRoleCommand => ({
  ...choicesOf(input),
  id,
  name: input.name ?? undefined,
  description: input.description,
  startFromRoleId: input.startFromRoleId ?? undefined,
});
