import { requirePermission } from '@cod/plugin-rbac/guard';
import type { OfferAppType, OfferPerformance, OfferPreview } from '@cod/shared';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withOffersErrors } from './error-mapping';
import { OfferActions } from './offer-actions';
import type { OfferCodeDto, OfferPageDto, OfferViewDto } from './offer-dto';
import { OFFER_PERMISSIONS } from './permissions';

/** The store's offers on the Admin API (D2519); the same actions as the REST routes. */
@Resolver()
export class OffersResolver {
  constructor(private readonly actions: OfferActions) {}

  /** A page of the active store's offers, newest first (offers.view). */
  @Query()
  @requirePermission(OFFER_PERMISSIONS.view)
  offers(@Ctx() ctx: RequestContext, @Args('options') options: unknown): Promise<OfferPageDto> {
    return withOffersErrors(() => this.actions.list(ctx, options));
  }

  /** One offer of the active store, or `null` (offers.view). */
  @Query()
  @requirePermission(OFFER_PERMISSIONS.view)
  offer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferViewDto | null> {
    return withOffersErrors(() => this.actions.get(ctx, id));
  }

  /** The offer's codes, oldest first (offers.view). */
  @Query()
  @requirePermission(OFFER_PERMISSIONS.view)
  offerCodes(@Ctx() ctx: RequestContext, @Args('offerId') offerId: unknown): Promise<OfferCodeDto[]> {
    return withOffersErrors(() => this.actions.codes(ctx, offerId));
  }

  /** The offer's orders, delivered revenue and discount given (offers.view, D2514). */
  @Query()
  @requirePermission(OFFER_PERMISSIONS.view)
  offerStats(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferPerformance> {
    return withOffersErrors(() => this.actions.stats(ctx, id));
  }

  /** The cards of the create dialog (offers.view, D2515). */
  @Query()
  @requirePermission(OFFER_PERMISSIONS.view)
  offerAppTypes(@Ctx() ctx: RequestContext): Promise<OfferAppType[]> {
    return withOffersErrors(() => this.actions.appTypes(ctx));
  }

  /** An unsaved offer priced on sample carts, never stored (offers.view, D2516). */
  @Query()
  @requirePermission(OFFER_PERMISSIONS.view)
  previewOffer(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<OfferPreview> {
    return withOffersErrors(() => this.actions.preview(ctx, input));
  }

  /** Creates a draft in the active store (offers.create). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.create)
  createOffer(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.create(ctx, input));
  }

  /** Edits an offer, refused when it changed since `version` was read (offers.edit, D2535). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  updateOffer(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
    @Args('version') version: unknown,
  ): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.update(ctx, id, input, version));
  }

  /** Publishes a draft (offers.edit, D2510). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  publishOffer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.publish(ctx, id));
  }

  /** Pauses an active offer (offers.edit). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  pauseOffer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.pause(ctx, id));
  }

  /** Resumes a paused offer (offers.edit, D2510). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  resumeOffer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.resume(ctx, id));
  }

  /** Archives an offer (offers.edit). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  archiveOffer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.archive(ctx, id));
  }

  /** Copies an offer into a new draft (offers.create, D2511). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.create)
  duplicateOffer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<OfferViewDto> {
    return withOffersErrors(() => this.actions.duplicate(ctx, id));
  }

  /** Deletes a draft (offers.delete, D2521). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.delete)
  async deleteOffer(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withOffersErrors(() => this.actions.delete(ctx, id));
    return true;
  }

  /** Adds codes to an offer activated by codes (offers.edit). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  addOfferCodes(
    @Ctx() ctx: RequestContext,
    @Args('offerId') offerId: unknown,
    @Args('codes') codes: unknown,
  ): Promise<OfferCodeDto[]> {
    return withOffersErrors(() => this.actions.addCodes(ctx, offerId, codes));
  }

  /** Generates random codes for an offer activated by codes (offers.edit, D2512). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  generateOfferCodes(
    @Ctx() ctx: RequestContext,
    @Args('offerId') offerId: unknown,
    @Args('input') input: unknown,
  ): Promise<OfferCodeDto[]> {
    return withOffersErrors(() => this.actions.generateCodes(ctx, offerId, input));
  }

  /** Removes a code of the offer; `false` when it had none (offers.edit). */
  @Mutation()
  @requirePermission(OFFER_PERMISSIONS.edit)
  removeOfferCode(
    @Ctx() ctx: RequestContext,
    @Args('offerId') offerId: unknown,
    @Args('code') code: unknown,
  ): Promise<boolean> {
    return withOffersErrors(() => this.actions.removeCode(ctx, offerId, code));
  }
}
