import { SNOWFLAKE_ID_GENERATOR } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { ActivityLogService } from '../application/activity-log.service';
import { BindingProjector } from '../application/binding-projector.service';
import { MemberAccessService } from '../application/member-access.service';
import {
  ACTOR_DIRECTORY,
  BUSINESS_DIRECTORY,
  BUSINESS_ROLES,
  CLOCK,
  ENGINE_ROLES,
  MEMBER_ASSIGNMENTS,
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
      SNOWFLAKE_ID_GENERATOR,
      CLOCK,
    ],
  },
];
