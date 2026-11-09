import { SNOWFLAKE_ID_GENERATOR } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { ActivityLogService } from '../application/activity-log.service';
import { BindingProjector } from '../application/binding-projector.service';
import { CreateRoleService } from '../application/create-role.service';
import { DeleteRoleService } from '../application/delete-role.service';
import { DuplicateRoleService } from '../application/duplicate-role.service';
import { EffectivePermissionsService } from '../application/effective-permissions.service';
import { GetRolesService } from '../application/get-roles.service';
import { RoleWriter } from '../application/role-writer';
import {
  BUSINESS_DIRECTORY,
  BUSINESS_ROLES,
  CLOCK,
  MEMBER_ASSIGNMENTS,
  RBAC_LOCK,
  ROLE_BINDINGS,
  SESSION_FLUSHER,
  TRANSACTION,
} from '../application/tokens';
import { UpdateRoleService } from '../application/update-role.service';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** Wires the custom-role use cases; kept out of the plugin file, which only lists its parts. */
export const ROLE_USE_CASE_PROVIDERS: Provider[] = [
  {
    provide: RoleWriter,
    useFactory: (
      ...[transaction, lock, roles, bindings, assignments, directory, activity, flusher, ids, clock]: [
        TransactionPort,
        RbacLockPort,
        BusinessRoleRepositoryPort,
        RoleBindingRepositoryPort,
        MemberAssignmentRepositoryPort,
        BusinessDirectoryPort,
        ActivityLogService,
        SessionFlusherPort,
        IdGeneratorPort,
        ClockPort,
      ]
    ) => new RoleWriter({ transaction, lock, roles, bindings, assignments, directory, activity, flusher, ids, clock }),
    inject: [
      TRANSACTION,
      RBAC_LOCK,
      BUSINESS_ROLES,
      ROLE_BINDINGS,
      MEMBER_ASSIGNMENTS,
      BUSINESS_DIRECTORY,
      ActivityLogService,
      SESSION_FLUSHER,
      SNOWFLAKE_ID_GENERATOR,
      CLOCK,
    ],
  },
  { provide: CreateRoleService, useFactory: (w: RoleWriter) => new CreateRoleService(w), inject: [RoleWriter] },
  { provide: DuplicateRoleService, useFactory: (w: RoleWriter) => new DuplicateRoleService(w), inject: [RoleWriter] },
  {
    provide: UpdateRoleService,
    useFactory: (w: RoleWriter, p: BindingProjector) => new UpdateRoleService(w, p),
    inject: [RoleWriter, BindingProjector],
  },
  {
    provide: DeleteRoleService,
    useFactory: (w: RoleWriter, p: BindingProjector) => new DeleteRoleService(w, p),
    inject: [RoleWriter, BindingProjector],
  },
  {
    provide: GetRolesService,
    useFactory: (roles: BusinessRoleRepositoryPort, assignments: MemberAssignmentRepositoryPort) =>
      new GetRolesService(roles, assignments),
    inject: [BUSINESS_ROLES, MEMBER_ASSIGNMENTS],
  },
  {
    provide: EffectivePermissionsService,
    useFactory: (
      roles: BusinessRoleRepositoryPort,
      assignments: MemberAssignmentRepositoryPort,
      directory: BusinessDirectoryPort,
    ) => new EffectivePermissionsService(roles, assignments, directory),
    inject: [BUSINESS_ROLES, MEMBER_ASSIGNMENTS, BUSINESS_DIRECTORY],
  },
];
