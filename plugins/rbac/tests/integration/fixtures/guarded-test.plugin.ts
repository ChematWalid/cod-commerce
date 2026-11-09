import { Controller, Get } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';
import { requirePermission } from '../../../api/require-permission.decorator';

@Resolver()
class GuardedTestResolver {
  @Mutation()
  @requirePermission('orders.cancel')
  rbacTestCancelOrder(): boolean {
    return true;
  }
}

@Resolver()
@requirePermission('orders.cancel')
class ClassGuardedTestResolver {
  @Mutation()
  rbacTestClassCancelOrder(): boolean {
    return true;
  }
}

@Controller('rbac-test')
class GuardedTestController {
  @Get('orders-view')
  @requirePermission('orders.view')
  ordersView(): { readonly ok: boolean } {
    return { ok: true };
  }
}

/** Vendure's guard reads a handler's metadata only, so the class form must reach each handler. */
@Controller('rbac-test/class-guarded')
@requirePermission('orders.view')
class ClassGuardedTestController {
  @Get()
  inherited(): { readonly ok: boolean } {
    return { ok: true };
  }

  @Get('cancel')
  @requirePermission('orders.cancel')
  ownPermission(): { readonly ok: boolean } {
    return { ok: true };
  }
}

/** Handlers that exist only to exercise `requirePermission`. */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin],
  controllers: [GuardedTestController, ClassGuardedTestController],
  adminApiExtensions: {
    schema: gql`
      extend type Mutation {
        rbacTestCancelOrder: Boolean!
        rbacTestClassCancelOrder: Boolean!
      }
    `,
    resolvers: [GuardedTestResolver, ClassGuardedTestResolver],
  },
})
// A Vendure plugin is a decorated class; this one only registers the fixtures.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GuardedTestPlugin {}
