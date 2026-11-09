import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { ActivityLogResolver } from './api/activity-log.resolver';
import { RBAC_PERMISSION_DEFINITIONS } from './api/permission-definitions';
import { adminApiSchema } from './api/schema';
import { ActivityLogService } from './application/activity-log.service';
import { GetActivityLogService } from './application/get-activity-log.service';
import { ACTIVITY_LOG, ACTOR_DIRECTORY, CLOCK } from './application/tokens';
import type { ActivityLogPort } from './domain/ports/activity-log.port';
import type { ActorDirectoryPort } from './domain/ports/actor-directory.port';
import type { ClockPort } from './domain/ports/clock.port';
import type { IdGeneratorPort } from './domain/ports/id-generator.port';
import { ActivityLogEntity } from './infrastructure/activity-log.entity';
import { ActivityRecordHandler } from './infrastructure/activity-record.handler';
import { BusinessRoleEntity } from './infrastructure/business-role.entity';
import { MemberRoleAssignmentEntity } from './infrastructure/member-role-assignment.entity';
import { RoleBindingEntity } from './infrastructure/role-binding.entity';
import { TypeOrmActivityLogRepository } from './infrastructure/typeorm-activity-log.repository';
import { VendureActorDirectory } from './infrastructure/vendure-actor-directory';

function addPermissions(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.authOptions.customPermissions.push(...RBAC_PERMISSION_DEFINITIONS);
  return config;
}

const systemClock: ClockPort = { now: () => new Date() };

/** The permission catalog on Vendure, the tables of business roles and the activity log. This module only wires the layers. */
@VendurePlugin({
  // `RateLimitPlugin` exports the `ClientIpResolver` that `requestOrigin` takes.
  imports: [PluginCommonModule, TenancyPlugin, RateLimitPlugin],
  entities: [BusinessRoleEntity, RoleBindingEntity, MemberRoleAssignmentEntity, ActivityLogEntity],
  providers: [
    { provide: ACTIVITY_LOG, useClass: TypeOrmActivityLogRepository },
    { provide: ACTOR_DIRECTORY, useClass: VendureActorDirectory },
    { provide: CLOCK, useValue: systemClock },
    {
      provide: ActivityLogService,
      useFactory: (log: ActivityLogPort, ids: IdGeneratorPort, clock: ClockPort) =>
        new ActivityLogService(log, ids, clock),
      inject: [ACTIVITY_LOG, SNOWFLAKE_ID_GENERATOR, CLOCK],
    },
    {
      provide: GetActivityLogService,
      useFactory: (log: ActivityLogPort, actors: ActorDirectoryPort) => new GetActivityLogService(log, actors),
      inject: [ACTIVITY_LOG, ACTOR_DIRECTORY],
    },
    ActivityRecordHandler,
  ],
  adminApiExtensions: { schema: adminApiSchema, resolvers: [ActivityLogResolver] },
  configuration: addPermissions,
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RbacPlugin {}
