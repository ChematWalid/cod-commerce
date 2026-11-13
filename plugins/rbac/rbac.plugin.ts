import { PartitionRegistry, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { BUILT_IN_ROLES } from '@cod/shared';
import { Inject } from '@nestjs/common';
import { PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { ActivityLogResolver } from './api/activity-log.resolver';
import { RBAC_PERMISSION_DEFINITIONS } from './api/permission-definitions';
import { RequestActors } from './api/actor-of';
import { MemberAccessResolver } from './api/member-access.resolver';
import { CatalogResolver } from './api/catalog.resolver';
import { RbacTranslations } from './api/rbac-translations';
import { RoleEditsResolver } from './api/role-edits.resolver';
import { PermissionsController } from './api/permissions.controller';
import { RoleEditsController } from './api/role-edits.controller';
import { RolesController } from './api/roles.controller';
import { RolesResolver } from './api/roles.resolver';
import { adminApiSchema } from './api/schema';
import { ActivityLogService } from './application/activity-log.service';
import { GrantPreviewService } from './application/grant-preview.service';
import { MemberAccessService } from './application/member-access.service';
import { BindingProjector } from './application/binding-projector.service';
import { GetActivityLogService } from './application/get-activity-log.service';
import { LiveMemberAssignments } from './application/live-member-assignments';
import { ExtendAllBindingsService } from './application/extend-all-bindings.service';
import { RbacConvergeService } from './application/rbac-converge.service';
import { SeedBuiltInRolesService } from './application/seed-built-in-roles.service';
import {
  ACTIVITY_LOG,
  ACTOR_DIRECTORY,
  BUSINESS_DIRECTORY,
  BUSINESS_ROLES,
  CLOCK,
  ENGINE_ROLES,
  MEMBER_ASSIGNMENTS,
  MEMBER_SUSPENSION_CHECK,
  RBAC_LOCK,
  ROLE_BINDINGS,
  SESSION_FLUSHER,
  TRANSACTION,
} from './application/tokens';
import type { ActivityLogPort } from './domain/ports/activity-log.port';
import type { ActorDirectoryPort } from './domain/ports/actor-directory.port';
import type { BusinessDirectoryPort } from './domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from './domain/ports/business-role-repository.port';
import type { ClockPort } from './domain/ports/clock.port';
import type { EngineRolesPort } from './domain/ports/engine-roles.port';
import type { IdGeneratorPort } from './domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from './domain/ports/member-assignment-repository.port';
import type { RbacLockPort } from './domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from './domain/ports/role-binding-repository.port';
import type { SessionFlusherPort } from './domain/ports/session-flusher.port';
import type { TransactionPort } from './domain/ports/transaction.port';
import { ACTIVITY_LOG_PARTITION_POLICY } from './infrastructure/activity-log-partition-policy';
import { ActivityLogEntity } from './infrastructure/activity-log.entity';
import { ActivityRecordHandler } from './infrastructure/activity-record.handler';
import { BusinessRoleEntity } from './infrastructure/business-role.entity';
import { MEMBER_ACCESS_PROVIDERS } from './infrastructure/member-access.providers';
import { MemberRoleAssignmentEntity } from './infrastructure/member-role-assignment.entity';
import { RbacLifecycleHook } from './infrastructure/rbac-lifecycle.hook';
import { RbacLock } from './infrastructure/rbac-lock';
import { ROLE_USE_CASE_PROVIDERS } from './infrastructure/role-use-case.providers';
import { RoleBindingEntity } from './infrastructure/role-binding.entity';
import { RoleSessionFlusher } from './infrastructure/role-session-flusher';
import { StoreAccessFlushSubscriber } from './infrastructure/store-access-flush.subscriber';
import { TenancyBusinessDirectory } from './infrastructure/tenancy-business-directory';
import { TenantTransactionAdapter } from './infrastructure/tenant-transaction.adapter';
import { TypeOrmActivityLogRepository } from './infrastructure/typeorm-activity-log.repository';
import { TypeOrmBusinessRoleRepository } from './infrastructure/typeorm-business-role.repository';
import { TypeOrmMemberAssignmentRepository } from './infrastructure/typeorm-member-assignment.repository';
import { TypeOrmRoleBindingRepository } from './infrastructure/typeorm-role-binding.repository';
import { VendureActorDirectory } from './infrastructure/vendure-actor-directory';
import { VendureEngineRoles } from './infrastructure/vendure-engine-roles';

function addPermissions(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.authOptions.customPermissions.push(...RBAC_PERMISSION_DEFINITIONS);
  return config;
}

const systemClock: ClockPort = { now: () => new Date() };

/** The permission catalog on Vendure, the tables of business roles and the activity log. This module only wires the layers. */
@VendurePlugin({
  // `RateLimitPlugin` exports the `ClientIpResolver` that `requestOrigin` takes.
  imports: [PluginCommonModule, TenancyPlugin, RateLimitPlugin, PlatformPartitionsPlugin],
  entities: [BusinessRoleEntity, RoleBindingEntity, MemberRoleAssignmentEntity, ActivityLogEntity],
  providers: [
    { provide: ACTIVITY_LOG, useClass: TypeOrmActivityLogRepository },
    { provide: ACTOR_DIRECTORY, useClass: VendureActorDirectory },
    { provide: CLOCK, useValue: systemClock },
    { provide: BUSINESS_ROLES, useClass: TypeOrmBusinessRoleRepository },
    { provide: ROLE_BINDINGS, useClass: TypeOrmRoleBindingRepository },
    TypeOrmMemberAssignmentRepository,
    {
      provide: MEMBER_ASSIGNMENTS,
      useFactory: (rows: MemberAssignmentRepositoryPort, actors: ActorDirectoryPort) =>
        new LiveMemberAssignments(rows, actors),
      inject: [TypeOrmMemberAssignmentRepository, ACTOR_DIRECTORY],
    },
    { provide: ENGINE_ROLES, useClass: VendureEngineRoles },
    { provide: SESSION_FLUSHER, useClass: RoleSessionFlusher },
    { provide: RBAC_LOCK, useClass: RbacLock },
    { provide: BUSINESS_DIRECTORY, useClass: TenancyBusinessDirectory },
    { provide: TRANSACTION, useClass: TenantTransactionAdapter },
    {
      provide: ActivityLogService,
      useFactory: (log: ActivityLogPort, ids: IdGeneratorPort, clock: ClockPort) =>
        new ActivityLogService(log, ids, clock),
      inject: [ACTIVITY_LOG, SNOWFLAKE_ID_GENERATOR, CLOCK],
    },
    {
      provide: GetActivityLogService,
      useFactory: (log: ActivityLogPort, actors: ActorDirectoryPort, assignments: MemberAssignmentRepositoryPort) =>
        new GetActivityLogService(log, actors, assignments),
      inject: [ACTIVITY_LOG, ACTOR_DIRECTORY, MEMBER_ASSIGNMENTS],
    },
    {
      provide: SeedBuiltInRolesService,
      useFactory: (
        ...[lock, roles, bindings, assignments, ids, clock]: [
          RbacLockPort,
          BusinessRoleRepositoryPort,
          RoleBindingRepositoryPort,
          MemberAssignmentRepositoryPort,
          IdGeneratorPort,
          ClockPort,
        ]
      ) => new SeedBuiltInRolesService({ lock, roles, bindings, assignments, ids, clock }),
      inject: [RBAC_LOCK, BUSINESS_ROLES, ROLE_BINDINGS, MEMBER_ASSIGNMENTS, SNOWFLAKE_ID_GENERATOR, CLOCK],
    },
    {
      provide: ExtendAllBindingsService,
      useFactory: (
        lock: RbacLockPort,
        roles: BusinessRoleRepositoryPort,
        bindings: RoleBindingRepositoryPort,
        engine: EngineRolesPort,
      ) => new ExtendAllBindingsService({ lock, roles, bindings, engine }),
      inject: [RBAC_LOCK, BUSINESS_ROLES, ROLE_BINDINGS, ENGINE_ROLES],
    },
    {
      provide: RbacConvergeService,
      useFactory: (
        ...[lock, roles, bindings, assignments, engine, directory, transaction, flusher, ids, clock]: [
          RbacLockPort,
          BusinessRoleRepositoryPort,
          RoleBindingRepositoryPort,
          MemberAssignmentRepositoryPort,
          EngineRolesPort,
          BusinessDirectoryPort,
          TransactionPort,
          SessionFlusherPort,
          IdGeneratorPort,
          ClockPort,
        ]
      ) =>
        new RbacConvergeService({
          lock,
          roles,
          bindings,
          assignments,
          engine,
          directory,
          transaction,
          flusher,
          ids,
          clock,
          templates: BUILT_IN_ROLES,
        }),
      inject: [
        RBAC_LOCK,
        BUSINESS_ROLES,
        ROLE_BINDINGS,
        MEMBER_ASSIGNMENTS,
        ENGINE_ROLES,
        BUSINESS_DIRECTORY,
        TRANSACTION,
        SESSION_FLUSHER,
        SNOWFLAKE_ID_GENERATOR,
        CLOCK,
      ],
    },
    {
      provide: BindingProjector,
      useFactory: (
        ...[bindings, assignments, engine, directory, ids]: [
          RoleBindingRepositoryPort,
          MemberAssignmentRepositoryPort,
          EngineRolesPort,
          BusinessDirectoryPort,
          IdGeneratorPort,
        ]
      ) => new BindingProjector({ bindings, assignments, engine, directory, ids }),
      inject: [ROLE_BINDINGS, MEMBER_ASSIGNMENTS, ENGINE_ROLES, BUSINESS_DIRECTORY, SNOWFLAKE_ID_GENERATOR],
    },
    ...MEMBER_ACCESS_PROVIDERS,
    ...ROLE_USE_CASE_PROVIDERS,
    RbacTranslations,
    RequestActors,
    ActivityRecordHandler,
    RbacLifecycleHook,
    StoreAccessFlushSubscriber,
  ],
  // Other plugins reach these through the member-access entry, from their adapters and module files only (D206).
  exports: [MemberAccessService, GrantPreviewService, MEMBER_SUSPENSION_CHECK],
  controllers: [RolesController, RoleEditsController, PermissionsController],
  adminApiExtensions: {
    schema: adminApiSchema,
    resolvers: [ActivityLogResolver, MemberAccessResolver, RolesResolver, RoleEditsResolver, CatalogResolver],
  },
  configuration: addPermissions,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class RbacPlugin {
  constructor(@Inject(PartitionRegistry) private readonly partitions: PartitionRegistry) {}

  /** The registry closes at bootstrap, so the activity log registers its monthly policy here (D123). */
  onModuleInit(): void {
    this.partitions.register(ACTIVITY_LOG_PARTITION_POLICY);
  }
}
