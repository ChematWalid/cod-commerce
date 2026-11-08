import type { TenantContext } from '@cod/shared';
import { Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  PluginCommonModule,
  type RequestContext,
  Transaction,
  TransactionalConnection,
  VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';
import { tenantOf } from '../../api/tenant-of';
import { TenantScoped } from '../../api/tenant-scoped.decorator';
import { TenancyPlugin } from '../../tenancy.plugin';

@Resolver()
class TenantProbeResolver {
  constructor(private readonly connection: TransactionalConnection) {}

  @Query()
  @Allow(Permission.Authenticated)
  @TenantScoped()
  tenantProbe(@Ctx() ctx: RequestContext): TenantContext {
    return tenantOf(ctx);
  }

  @Query()
  @Allow(Permission.Public)
  @TenantScoped()
  publicTenantProbe(@Ctx() ctx: RequestContext): TenantContext {
    return tenantOf(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  @TenantScoped()
  @Transaction()
  tenantProbeInTransaction(@Ctx() ctx: RequestContext): TenantContext {
    return tenantOf(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  @TenantScoped()
  tenantProbeWithTransaction(@Ctx() ctx: RequestContext): Promise<TenantContext> {
    return this.connection.withTransaction(ctx, (transactional) => Promise.resolve(tenantOf(transactional)));
  }
}

@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin],
  adminApiExtensions: {
    schema: gql`
      type TenantProbe {
        businessId: String!
        storeIds: [String!]!
        activeStoreId: String!
      }
      extend type Query {
        tenantProbe: TenantProbe!
        publicTenantProbe: TenantProbe!
        tenantProbeInTransaction: TenantProbe!
        tenantProbeWithTransaction: TenantProbe!
      }
    `,
    resolvers: [TenantProbeResolver],
  },
})
// A Vendure plugin is a decorated class; this one only registers the probe.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TenantProbePlugin {}
