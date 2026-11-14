import { TenantScoped } from '@cod/plugin-tenancy';
import { ConflictException, Controller, Get, Query } from '@nestjs/common';
import { Allow, Ctx, Permission, PluginCommonModule, type RequestContext, VendurePlugin } from '@vendure/core';
import {
  asCatalogOperationContext,
  CatalogPlugin,
  CatalogReadService,
  NoActiveStoreError,
  type PublicListContext,
  type PublicVisibilityContext,
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

/** Registers the probe beside the catalog in the catalog-read integration test only. */
@VendurePlugin({ imports: [PluginCommonModule, CatalogPlugin], controllers: [CatalogReadProbeController] })
// A Vendure plugin is a decorated module class with no members of its own.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CatalogReadProbePlugin {}
