import { TenancyPlugin, TenantScoped } from '@cod/plugin-tenancy';
import { ConflictException, Controller, Get, Query } from '@nestjs/common';
import { Allow, Ctx, Permission, PluginCommonModule, type RequestContext, VendurePlugin } from '@vendure/core';
import {
  asCatalogOperationContext,
  CatalogPlugin,
  type CoreId,
  CatalogReadService,
  NoActiveStoreError,
  type PublicListContext,
  type PublicVisibilityContext,
  type VisibleProduct,
  type VisibleProductPage,
} from '../../index';

/** What the probe answers for one product a public context shows. */
export interface ProbedProduct {
  readonly title: string;
  readonly soldOut: boolean;
  readonly orderable: boolean;
}

const PAGE = { skip: 0, take: 100 };

/** What the untenanted route answers when the read refused for want of an active store, and only then. */
export const NO_ACTIVE_STORE_REFUSAL = 'no-active-store';
const probed = ({ title, soldOut, orderable }: ProbedProduct): ProbedProduct => ({ title, soldOut, orderable });

/** The images and options a product page shows, as the probe answers them (#246, P3.S2 previews). */
export interface ProbedShape {
  readonly featuredAsset: VisibleProduct['featuredAsset'];
  readonly assets: VisibleProduct['assets'];
  readonly variantPreviews: readonly (string | null)[];
  readonly optionGroups: readonly { readonly name: string; readonly values: readonly string[] }[];
}

const shapeOf = (product: VisibleProduct): ProbedShape => ({
  featuredAsset: product.featuredAsset,
  assets: product.assets,
  variantPreviews: product.variants.map((variant) => variant.featuredAssetPreview),
  optionGroups: product.optionGroups.map((group) => ({
    name: group.name,
    values: group.values.map((value) => value.name),
  })),
});

/** What the probe answers for a page of the products among given ids (D2310). */
export interface ProbedIdPage {
  readonly ids: readonly string[];
  readonly totalItems: number;
}

/** The ids of a comma-separated query value, as sent: malformed ones reach the read service untouched. */
const idsOf = (value: string | undefined): CoreId[] => (value ?? '').split(',').filter((id) => id !== '') as CoreId[];
const idPageOf = (page: VisibleProductPage): ProbedIdPage => ({
  ids: page.items.map((item) => item.id),
  totalItems: page.totalItems,
});

/**
 * A stand-in for P3's storefront (no public endpoint exists in P2.S1): it calls the exported `CatalogReadService` the
 * way a later plugin will, behind the tenant guard, so the read derives its store from the request (D2142).
 */
@Controller('test/catalog-read')
class CatalogReadProbeController {
  constructor(private readonly reads: CatalogReadService) {}

  @Get('list')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async list(@Ctx() ctx: RequestContext, @Query('context') context: PublicListContext): Promise<ProbedProduct[]> {
    const page = await this.reads.listVisible(asCatalogOperationContext(ctx), context, PAGE);
    return page.items.map(probed);
  }

  @Get('slug')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async slug(
    @Ctx() ctx: RequestContext,
    @Query('slug') slug: string,
    @Query('context') context: PublicVisibilityContext,
  ): Promise<ProbedProduct | null> {
    const found = await this.reads.findBySlug(asCatalogOperationContext(ctx), slug, context);
    return found === undefined ? null : probed(found);
  }

  /** The images and options the product page of `slug` shows. */
  @Get('shape')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async shape(@Ctx() ctx: RequestContext, @Query('slug') slug: string): Promise<ProbedShape | null> {
    const found = await this.reads.findBySlug(asCatalogOperationContext(ctx), slug, 'productPage');
    return found === undefined ? null : shapeOf(found);
  }

  /** The products among `ids` the context lists, in the given order (manual collections, D2310). */
  @Get('among')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async among(
    @Ctx() ctx: RequestContext,
    @Query('ids') ids: string | undefined,
    @Query('skip') skip: string | undefined,
  ): Promise<ProbedIdPage> {
    const page = { skip: Number(skip ?? '0'), take: PAGE.take };
    return idPageOf(await this.reads.listVisibleAmong(asCatalogOperationContext(ctx), 'listing', idsOf(ids), page));
  }

  /** The products among `ids` the listing shows, newest first (automatic collections, D2310). */
  @Get('list-among')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async listAmong(@Ctx() ctx: RequestContext, @Query('ids') ids: string | undefined): Promise<ProbedIdPage> {
    const options = { ...PAGE, productIds: idsOf(ids) };
    return idPageOf(await this.reads.listVisible(asCatalogOperationContext(ctx), 'listing', options));
  }

  /** No tenant guard: the read must refuse a context without an active store; that refusal alone answers 409. */
  @Get('untenanted')
  @Allow(Permission.Public)
  async untenanted(@Ctx() ctx: RequestContext): Promise<number> {
    try {
      return (await this.reads.listVisible(asCatalogOperationContext(ctx), 'listing', PAGE)).totalItems;
    } catch (error: unknown) {
      if (error instanceof NoActiveStoreError) throw new ConflictException(NO_ACTIVE_STORE_REFUSAL);
      throw error;
    }
  }
}

/**
 * Registers the probe beside the catalog in the catalog-read integration test only. It imports `TenancyPlugin` itself,
 * because `@TenantScoped` puts `TenantGuard` on its own controller and the guard's resolver must be visible here.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, CatalogPlugin],
  controllers: [CatalogReadProbeController],
})
// A Vendure plugin is a decorated module class with no members of its own.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CatalogReadProbePlugin {}
