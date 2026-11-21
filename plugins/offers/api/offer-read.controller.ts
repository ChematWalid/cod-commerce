import { requirePermission } from '@cod/plugin-rbac/guard';
import type { OfferAppType, OfferPerformance, OfferPreview } from '@cod/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { OfferNotFoundError } from '../domain/errors';
import { OFFERS_REST_FILTERS, restCall } from './error-mapping';
import { OfferActions } from './offer-actions';
import type { OfferCodeDto, OfferPageDto, OfferViewDto } from './offer-dto';
import { OFFER_PERMISSIONS } from './permissions';

/**
 * The reads of the store's offers for clients that do not speak GraphQL (ADR 0017, D2518). Registered before the
 * write controller, and `app-types` and `preview` declared before `:id`, which would otherwise take them for an id.
 */
@Controller('offers')
@UseFilters(...OFFERS_REST_FILTERS)
export class OfferReadController {
  constructor(private readonly actions: OfferActions) {}

  /** A page of the active store's offers (offers.view); the query string is the list input. */
  @Get()
  @requirePermission(OFFER_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<OfferPageDto> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** The cards of the create dialog (offers.view, D2515). */
  @Get('app-types')
  @requirePermission(OFFER_PERMISSIONS.view)
  appTypes(@Ctx() ctx: RequestContext): Promise<OfferAppType[]> {
    return restCall(() => this.actions.appTypes(ctx));
  }

  /** An unsaved offer priced on sample carts, never stored (offers.view, D2516); 200, nothing is created. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @requirePermission(OFFER_PERMISSIONS.view)
  preview(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<OfferPreview> {
    return restCall(() => this.actions.preview(ctx, body));
  }

  /** One offer of the active store (offers.view); 404 `offers.offer-not-found` otherwise. */
  @Get(':id')
  @requirePermission(OFFER_PERMISSIONS.view)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferViewDto> {
    return restCall(async () => {
      const offer = await this.actions.get(ctx, id);
      if (offer === null) throw new OfferNotFoundError();
      return offer;
    });
  }

  /** The offer's orders, delivered revenue and discount given (offers.view, D2514). */
  @Get(':id/stats')
  @requirePermission(OFFER_PERMISSIONS.view)
  stats(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferPerformance> {
    return restCall(() => this.actions.stats(ctx, id));
  }

  /** The offer's codes, oldest first (offers.view). */
  @Get(':id/codes')
  @requirePermission(OFFER_PERMISSIONS.view)
  codes(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferCodeDto[]> {
    return restCall(() => this.actions.codes(ctx, id));
  }
}
