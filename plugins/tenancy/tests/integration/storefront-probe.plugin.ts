import { Controller, Get } from '@nestjs/common';
import { Allow, Permission, PluginCommonModule, type RequestContext, VendurePlugin } from '@vendure/core';
import { StorefrontCtx, StorefrontScoped } from '../../api/storefront-ctx.decorator';
import { storefrontStoreOf } from '../../api/storefront-store-of';
import { findTenant } from '../../api/tenant-of';
import { TenancyPlugin } from '../../tenancy.plugin';

/** The probe's route; outside `/store`, which the real storefront API owns. */
export const STOREFRONT_PROBE_ROUTE = 'storefront-probe';

/**
 * Stands in for the internal-only middleware (D111), which these tests do not register: the store id of this header
 * becomes the signed one. Production never trusts a header; the signed path is covered by the server e2e suite.
 */
export const SIGNED_STORE_TEST_HEADER = 'x-test-signed-store';

/** The part of an Express request the stand-in reads and writes. */
interface ProbeRequest {
  header(name: string): string | undefined;
  internalAuth?: unknown;
}

const signAsTest = (req: ProbeRequest, _res: unknown, next: () => void): void => {
  const storeId = req.header(SIGNED_STORE_TEST_HEADER);
  if (storeId !== undefined) {
    req.internalAuth = { kid: 'test', storeId };
  }
  next();
};

@Controller(STOREFRONT_PROBE_ROUTE)
@StorefrontScoped()
class StorefrontProbeController {
  /** What a storefront handler sees of its context. */
  @Get()
  @Allow(Permission.Public)
  probe(@StorefrontCtx() ctx: RequestContext): Record<string, unknown> {
    return {
      channelId: ctx.channelId,
      apiType: ctx.apiType,
      tenant: findTenant(ctx),
      store: storefrontStoreOf(ctx),
      copiedTenant: findTenant(ctx.copy()),
    };
  }
}

@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin],
  controllers: [StorefrontProbeController],
  configuration: (config) => {
    config.apiOptions.middleware.push({ route: STOREFRONT_PROBE_ROUTE, handler: signAsTest });
    return config;
  },
})
// A Vendure plugin is a decorated class; this one only registers the probe.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StorefrontProbePlugin {}
