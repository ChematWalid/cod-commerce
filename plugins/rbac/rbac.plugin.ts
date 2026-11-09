import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { RBAC_PERMISSION_DEFINITIONS } from './api/permission-definitions';
import { ActivityLogEntity } from './infrastructure/activity-log.entity';
import { BusinessRoleEntity } from './infrastructure/business-role.entity';
import { MemberRoleAssignmentEntity } from './infrastructure/member-role-assignment.entity';
import { RoleBindingEntity } from './infrastructure/role-binding.entity';

function addPermissions(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.authOptions.customPermissions.push(...RBAC_PERMISSION_DEFINITIONS);
  return config;
}

/** The permission catalog on Vendure, and the tables of business roles. This module only wires the layers. */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin],
  entities: [BusinessRoleEntity, RoleBindingEntity, MemberRoleAssignmentEntity, ActivityLogEntity],
  configuration: addPermissions,
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RbacPlugin {}
