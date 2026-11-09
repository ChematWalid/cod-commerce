import type { AreaLevel, PermissionArea, PermissionKey } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { EFFECTIVE_PERMISSIONS_QUERY_KEY, ROLES_QUERY_KEY } from './constants';
import type { RoleChoicesInput } from './role-draft';

/** A role as the API answers it. Documents are untyped and typed here, as `plugins/_template` does. */
export interface BusinessRoleDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly builtInKey: string | null;
  readonly isBuiltIn: boolean;
  readonly permissions: readonly PermissionKey[];
  readonly areaLevels: readonly { readonly area: PermissionArea; readonly level: AreaLevel | 'custom' }[];
  readonly permissionCount: number;
  readonly memberCount: number;
  readonly updatedAt: string;
}

export interface ActivityLogItemDto {
  readonly id: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly diff: unknown;
  readonly actor: { readonly id: string; readonly name: string } | null;
  readonly createdAt: string;
}

export interface ActivityLogPageDto {
  readonly items: readonly ActivityLogItemDto[];
  readonly nextCursor: string | null;
}

export interface StoreStatusDto {
  readonly id: string;
  readonly status: string;
}

/** A role form's values: its text fields and the choices, never a permission list. */
export interface RoleFormInput extends RoleChoicesInput {
  readonly name: string;
  readonly description: string | null;
}

const ROLE_FIELDS = /* GraphQL */ `
  fragment RbacRoleFields on BusinessRole {
    id
    name
    description
    builtInKey
    isBuiltIn
    permissions
    areaLevels {
      area
      level
    }
    permissionCount
    memberCount
    updatedAt
  }
`;

const BUSINESS_ROLES_QUERY = /* GraphQL */ `
  query RbacBusinessRoles {
    businessRoles {
      ...RbacRoleFields
    }
  }
  ${ROLE_FIELDS}
`;

const EFFECTIVE_PERMISSIONS_QUERY = /* GraphQL */ `
  query RbacEffectivePermissions {
    effectivePermissions {
      permissions
    }
  }
`;

const CREATE_ROLE_MUTATION = /* GraphQL */ `
  mutation RbacCreateRole($input: CreateBusinessRoleInput!) {
    createBusinessRole(input: $input) {
      id
    }
  }
`;

const UPDATE_ROLE_MUTATION = /* GraphQL */ `
  mutation RbacUpdateRole($id: String!, $input: UpdateBusinessRoleInput!) {
    updateBusinessRole(id: $id, input: $input) {
      id
    }
  }
`;

const DELETE_ROLE_MUTATION = /* GraphQL */ `
  mutation RbacDeleteRole($id: String!) {
    deleteBusinessRole(id: $id) {
      success
    }
  }
`;

const DUPLICATE_ROLE_MUTATION = /* GraphQL */ `
  mutation RbacDuplicateRole($id: String!, $locale: String) {
    duplicateBusinessRole(id: $id, locale: $locale) {
      id
    }
  }
`;

const ACTIVITY_LOG_QUERY = /* GraphQL */ `
  query RbacActivityLog($input: ActivityLogInput) {
    activityLog(input: $input) {
      items {
        id
        action
        entityType
        entityId
        diff
        actor {
          id
          name
        }
        createdAt
      }
      nextCursor
    }
  }
`;

const STORE_STATUSES_QUERY = /* GraphQL */ `
  query RbacStoreStatuses {
    stores {
      id
      status
    }
  }
`;

/** The roles of the business, built-ins included. */
export function useBusinessRoles(): ReturnType<typeof useQuery<readonly BusinessRoleDto[]>> {
  return useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: async () =>
      (await api.query<{ readonly businessRoles: readonly BusinessRoleDto[] }>(BUSINESS_ROLES_QUERY)).businessRoles,
    retry: false,
  });
}

/** What the server says the caller holds on the active store; empty until it answers, so no control flashes. */
export function useEffectivePermissions(): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: EFFECTIVE_PERMISSIONS_QUERY_KEY,
    queryFn: () =>
      api.query<{ readonly effectivePermissions: { readonly permissions: readonly string[] } }>(
        EFFECTIVE_PERMISSIONS_QUERY,
      ),
    retry: false,
  });
  return new Set(data?.effectivePermissions.permissions ?? []);
}

export function createRole(input: RoleFormInput): Promise<unknown> {
  return api.mutate(CREATE_ROLE_MUTATION, { input });
}

export function updateRole(id: string, input: RoleFormInput): Promise<unknown> {
  return api.mutate(UPDATE_ROLE_MUTATION, { id, input });
}

export function deleteRole(id: string): Promise<unknown> {
  return api.mutate(DELETE_ROLE_MUTATION, { id });
}

/** The server names the copy, in `locale` (D71). */
export function duplicateRole(id: string, locale: string): Promise<unknown> {
  return api.mutate(DUPLICATE_ROLE_MUTATION, { id, locale });
}

export async function fetchActivityLog(after: string | null): Promise<ActivityLogPageDto> {
  const input = after === null ? {} : { after };
  const answer = await api.query<{ readonly activityLog: ActivityLogPageDto }>(ACTIVITY_LOG_QUERY, { input });
  return answer.activityLog;
}

export async function fetchStoreStatuses(): Promise<readonly StoreStatusDto[]> {
  return (await api.query<{ readonly stores: readonly StoreStatusDto[] }>(STORE_STATUSES_QUERY)).stores;
}
