import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { OFFERS_REST_FILTERS, restCall } from './error-mapping';
import { OfferActions } from './offer-actions';
import type { OfferCodeDto, OfferViewDto, SuccessDto } from './offer-dto';
import { OFFER_PERMISSIONS } from './permissions';
import { fieldOf } from './request-body';

/** The writes of the store's offers for clients that do not speak GraphQL (ADR 0017, D2518). */
@Controller('offers')
@UseFilters(...OFFERS_REST_FILTERS)
export class OffersController {
  constructor(private readonly actions: OfferActions) {}

  /** Creates a draft in the active store (offers.create); 201 with the offer. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(OFFER_PERMISSIONS.create)
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<OfferViewDto> {
    return restCall(() => this.actions.create(ctx, body));
  }

  /** Edits an offer (offers.edit); the body is the patch, with an optional `version` it was read at (D2535). */
  @Patch(':id')
  @requirePermission(OFFER_PERMISSIONS.edit)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<OfferViewDto> {
    return restCall(() => this.actions.update(ctx, id, body, fieldOf(body, 'version')));
  }

  /** Publishes a draft (offers.edit, D2510). */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @requirePermission(OFFER_PERMISSIONS.edit)
  publish(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferViewDto> {
    return restCall(() => this.actions.publish(ctx, id));
  }

  /** Pauses an active offer (offers.edit). */
  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @requirePermission(OFFER_PERMISSIONS.edit)
  pause(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferViewDto> {
    return restCall(() => this.actions.pause(ctx, id));
  }

  /** Resumes a paused offer (offers.edit, D2510). */
  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @requirePermission(OFFER_PERMISSIONS.edit)
  resume(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferViewDto> {
    return restCall(() => this.actions.resume(ctx, id));
  }

  /** Archives an offer (offers.edit). */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @requirePermission(OFFER_PERMISSIONS.edit)
  archive(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferViewDto> {
    return restCall(() => this.actions.archive(ctx, id));
  }

  /** Copies an offer into a new draft (offers.create, D2511); 201 with the copy. */
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(OFFER_PERMISSIONS.create)
  duplicate(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<OfferViewDto> {
    return restCall(() => this.actions.duplicate(ctx, id));
  }

  /** Deletes a draft (offers.delete, D2521). */
  @Delete(':id')
  @requirePermission(OFFER_PERMISSIONS.delete)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessDto> {
    await restCall(() => this.actions.delete(ctx, id));
    return { success: true };
  }

  /** Adds codes (offers.edit); the body is `{ codes: [{ code, usageLimit? }] }`, 201 with the stored codes. */
  @Post(':id/codes')
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(OFFER_PERMISSIONS.edit)
  addCodes(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<OfferCodeDto[]> {
    return restCall(() => this.actions.addCodes(ctx, id, fieldOf(body, 'codes')));
  }

  /** Generates codes (offers.edit, D2512); the body is `{ count, prefix?, usageLimit? }`, 201 with the codes. */
  @Post(':id/codes/generate')
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(OFFER_PERMISSIONS.edit)
  generateCodes(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<OfferCodeDto[]> {
    return restCall(() => this.actions.generateCodes(ctx, id, body));
  }

  /** Removes a code of the offer (offers.edit); `success` is false when the offer had no such code. */
  @Delete(':id/codes/:code')
  @requirePermission(OFFER_PERMISSIONS.edit)
  async removeCode(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('code') code: string,
  ): Promise<SuccessDto> {
    return { success: await restCall(() => this.actions.removeCode(ctx, id, code)) };
  }
}
