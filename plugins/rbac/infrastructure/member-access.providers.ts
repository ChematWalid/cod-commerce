import { SNOWFLAKE_ID_GENERATOR } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { ActivityLogService } from '../application/activity-log.service';
import { BindingProjector } from '../application/binding-projector.service';
import { GrantPreviewService } from '../application/grant-preview.service';
import { MemberAccessService } from '../application/member-access.service';
import { MemberSuspensionRegistry } from '../application/member-suspension-registry';
import {
  ACTOR_DIRECTORY,
  BUSINESS_DIRECTORY,
  BUSINESS_ROLES,
  CLOCK,
  ENGINE_ROLES,
  MEMBER_ASSIGNMENTS,
  MEMBER_SUSPENSION_CHECK,
  RBAC_LOCK,
  SESSION_FLUSHER,
  TRANSACTION,
} from '../application/tokens';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { EngineRolesPort } from '../domain/ports/engine-roles.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

type MemberAccessDependencies = [
  TransactionPort,
  RbacLockPort,
  ActorDirectoryPort,
  BusinessDirectoryPort,
  BusinessRoleRepositoryPort,
  MemberAssignmentRepositoryPort,
  EngineRolesPort,
  BindingProjector,
  ActivityLogService,
  SessionFlusherPort,
  MemberSuspensionRegistry,
  IdGeneratorPort,
  ClockPort,
];

/** Wires the member-access use case; kept out of the plugin file, which only lists its parts. */
export const MEMBER_ACCESS_PROVIDERS: Provider[] = [
  {
    provide: MemberAccessService,
    useFactory: (
      ...[
        transaction,
        lock,
        members,
        directory,
        roles,
        assignments,
        engine,
        projector,
        activity,
        flusher,
        suspension,
        ids,
        clock,
      ]: MemberAccessDependencies
    ) =>
      new MemberAccessService({
        transaction,
        lock,
        members,
        directory,
        roles,
        assignments,
        engine,
        projector,
        activity,
        flusher,
        suspension,
        ids,
        clock,
      }),
    inject: [
      TRANSACTION,
      RBAC_LOCK,
      ACTOR_DIRECTORY,
      BUSINESS_DIRECTORY,
      BUSINESS_ROLES,
      MEMBER_ASSIGNMENTS,
      ENGINE_ROLES,
      BindingProjector,
      ActivityLogService,
      SESSION_FLUSHER,
      MEMBER_SUSPENSION_CHECK,
      SNOWFLAKE_ID_GENERATOR,
      CLOCK,
    ],
  },
  // One registry per application: Team registers its check on it from its own module (D204).
  { provide: MEMBER_SUSPENSION_CHECK, useFactory: () => new MemberSuspensionRegistry() },
  {
    provide: GrantPreviewService,
    useFactory: (
      directory: BusinessDirectoryPort,
      roles: BusinessRoleRepositoryPort,
      assignments: MemberAssignmentRepositoryPort,
    ) => new GrantPreviewService({ directory, roles, assignments }),
    inject: [BUSINESS_DIRECTORY, BUSINESS_ROLES, MEMBER_ASSIGNMENTS],
  },
];
