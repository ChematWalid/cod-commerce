import type { PublicListContext, VisibleProductPage } from '@cod/plugin-catalog';
import { TenancyPlugin, TenantScoped, tenantOf } from '@cod/plugin-tenancy';
import { ConflictException, Controller, Get, Query } from '@nestjs/common';
import {
  Allow,
  Ctx,
  Permission,
  PluginCommonModule,
  type RequestContext,
  RequestContextService,
  VendurePlugin,
} from '@vendure/core';
import {
  asCollectionsOperationContext,
  CollectionMembershipQueries,
  CollectionsNoActiveStoreError,
  CollectionsReadService,
  CollectionsRulesPlugin,
  type CollectionsStoreScope,
} from '../../index';

/** What the untenanted and other-channel routes answer when the read refused for want of an active store, and only then. */
export const NO_ACTIVE_STORE_REFUSAL = 'no-active-store';

/** A page as the probe answers it: ids only, raw engine ids. */
export interface ProbedPage {
  readonly ids: readonly string[];
  readonly totalItems: number;
}

const PAGE_TAKE = 100;
const pageOf = (skip: string | undefined) => ({ skip: Number(skip ?? '0'), take: PAGE_TAKE });
const listOf = (value: string | undefined): string[] => (value ?? '').split(',').filter((id) => id !== '');
const probedProducts = (page: VisibleProductPage): ProbedPage => ({
  ids: page.items.map((item) => item.id),
  totalItems: page.totalItems,
});
const scopeOf = (ctx: RequestContext): CollectionsStoreScope => {
  const { businessId, activeStoreId } = tenantOf(ctx);
  return { businessId, storeId: activeStoreId };
};

/** Runs a read that must refuse with `CollectionsNoActiveStoreError`; that refusal alone answers 409. */
async function refusedWithoutStore(read: () => Promise<unknown>): Promise<unknown> {
  try {
    return await read();
  } catch (error: unknown) {
    if (error instanceof CollectionsNoActiveStoreError) throw new ConflictException(NO_ACTIVE_STORE_REFUSAL);
    throw error;
  }
}

/**
 * A stand-in for P3.S2's storefront routes (D2316) and P2.S4's offer checks (D2317): it calls the exported services
 * the way a later plugin will, behind the tenant guard, so the read derives its store from the request (D2142).
 */
@Controller('test/collections-read')
class CollectionsReadProbeController {
  constructor(
    private readonly reads: CollectionsReadService,
    private readonly membership: CollectionMembershipQueries,
    private readonly contexts: RequestContextService,
  ) {}

  @Get('list')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async list(@Ctx() ctx: RequestContext, @Query('skip') skip: string | undefined): Promise<ProbedPage> {
    const page = await this.reads.listVisible(asCollectionsOperationContext(ctx), pageOf(skip));
    return { ids: page.items.map((item) => item.id), totalItems: page.totalItems };
  }

  @Get('products')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async products(
    @Ctx() ctx: RequestContext,
    @Query('id') id: string,
    @Query('context') context: PublicListContext | undefined,
  ): Promise<ProbedPage | null> {
    const page = await this.reads.productsOf(asCollectionsOperationContext(ctx), id, context ?? 'listing', pageOf('0'));
    return page === undefined ? null : probedProducts(page);
  }

  /** Every member id of a visible collection, `null` when the store shows no such collection (P3.S2, D3206). */
  @Get('visible-members')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async visibleMembers(@Ctx() ctx: RequestContext, @Query('id') id: string): Promise<string[] | null> {
    return (await this.reads.visibleMemberIds(asCollectionsOperationContext(ctx), id)) ?? null;
  }

  /**
   * The visible collection of the store whose slug is `slug`, its id only, or `null`. Wrapped in an object: Nest sends
   * a bare string as text, which a JSON reader turns into a number.
   */
  @Get('by-slug')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async bySlug(@Ctx() ctx: RequestContext, @Query('slug') slug: string | undefined): Promise<{ id: string | null }> {
    const found = await this.reads.findVisibleBySlug(asCollectionsOperationContext(ctx), slug ?? '');
    return { id: found === undefined ? null : found.id };
  }

  /** The caller's tenant on the channel of `token`, another store's: the read must refuse it (D2142). */
  @Get('other-channel')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async otherChannel(@Ctx() ctx: RequestContext, @Query('token') token: string): Promise<unknown> {
    const onOther = await this.contexts.create({ apiType: 'admin', channelOrToken: token, req: ctx.req });
    return refusedWithoutStore(() => this.reads.listVisible(asCollectionsOperationContext(onOther), pageOf('0')));
  }

  /** No tenant guard: the read must refuse a context without an active store. */
  @Get('untenanted')
  @Allow(Permission.Public)
  async untenanted(@Ctx() ctx: RequestContext): Promise<unknown> {
    return refusedWithoutStore(() => this.reads.listVisible(asCollectionsOperationContext(ctx), pageOf('0')));
  }

  @Get('members')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  members(@Ctx() ctx: RequestContext, @Query('id') id: string): Promise<readonly string[]> {
    return this.membership.productIdsOf(asCollectionsOperationContext(ctx), scopeOf(ctx), id);
  }

  @Get('of-products')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async ofProducts(@Ctx() ctx: RequestContext, @Query('ids') ids: string | undefined): Promise<object> {
    const found = await this.membership.collectionIdsOfProducts(
      asCollectionsOperationContext(ctx),
      scopeOf(ctx),
      listOf(ids),
    );
    return Object.fromEntries(found);
  }

  @Get('is-member')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  isMember(@Ctx() ctx: RequestContext, @Query('id') id: string, @Query('product') product: string): Promise<boolean> {
    return this.membership.isMember(asCollectionsOperationContext(ctx), scopeOf(ctx), id, product);
  }

  @Get('existing')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  existing(@Ctx() ctx: RequestContext, @Query('ids') ids: string | undefined): Promise<readonly string[]> {
    return this.membership.existingCollectionIds(asCollectionsOperationContext(ctx), scopeOf(ctx), listOf(ids));
  }
}

/**
 * Registers the probe beside collections-rules in the public-read integration test only. It imports `TenancyPlugin`
 * itself, because `@TenantScoped` puts `TenantGuard` on its own controller and the guard's resolver must be visible.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, CollectionsRulesPlugin],
  controllers: [CollectionsReadProbeController],
})
// A Vendure plugin is a decorated module class with no members of its own.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CollectionsReadProbePlugin {}
