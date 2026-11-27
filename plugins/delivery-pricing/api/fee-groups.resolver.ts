import { requirePermission } from '@cod/plugin-rbac/guard';
import type { DeliveryFeeGroup, DeliveryFeeGroupPage } from '@cod/shared';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withDeliveryPricingErrors } from './error-mapping';
import { FeeGroupActions } from './fee-group-actions';
import { DELIVERY_PRICING_PERMISSIONS as P } from './permissions';

/** The active store's fee groups on the Admin API; the same actions as the REST routes. */
@Resolver()
export class FeeGroupsResolver {
  constructor(private readonly actions: FeeGroupActions) {}

  /** A page of the store's fee groups, newest first (delivery.pricing.view). */
  @Query()
  @requirePermission(P.view)
  deliveryFeeGroups(@Ctx() ctx: RequestContext, @Args('options') options: unknown): Promise<DeliveryFeeGroupPage> {
    return withDeliveryPricingErrors(() => this.actions.list(ctx, options));
  }

  /** One fee group with its wilaya and commune rows, or `null` (delivery.pricing.view). */
  @Query()
  @requirePermission(P.view)
  deliveryFeeGroup(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<DeliveryFeeGroup | null> {
    return withDeliveryPricingErrors(() => this.actions.get(ctx, id));
  }

  /** Creates a fee group with one rate per wilaya (delivery.pricing.create). */
  @Mutation()
  @requirePermission(P.create)
  createDeliveryFeeGroup(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<DeliveryFeeGroup> {
    return withDeliveryPricingErrors(() => this.actions.create(ctx, input));
  }

  /** Replaces a fee group's settings and wilaya rates; its commune rows stay (delivery.pricing.edit). */
  @Mutation()
  @requirePermission(P.edit)
  updateDeliveryFeeGroup(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
  ): Promise<DeliveryFeeGroup> {
    return withDeliveryPricingErrors(() => this.actions.update(ctx, id, input));
  }

  /** Deletes a fee group that is neither the store's default nor its platform default (delivery.pricing.delete). */
  @Mutation()
  @requirePermission(P.delete)
  async deleteDeliveryFeeGroup(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withDeliveryPricingErrors(() => this.actions.delete(ctx, id));
    return true;
  }

  /** Merges the named communes of one wilaya into a fee group (delivery.pricing.edit, D3125). */
  @Mutation()
  @requirePermission(P.edit)
  setDeliveryFeeCommuneRates(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: unknown,
    @Args('provinceCode') provinceCode: unknown,
    @Args('rows') rows: unknown,
  ): Promise<DeliveryFeeGroup> {
    return withDeliveryPricingErrors(() => this.actions.setCommuneRates(ctx, groupId, provinceCode, rows));
  }

  /** Raises or lowers the selected wilayas' prices by DZD or % as overrides (delivery.pricing.edit, D3140). */
  @Mutation()
  @requirePermission(P.edit)
  adjustDeliveryFeeGroupPrices(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: unknown,
    @Args('input') input: unknown,
  ): Promise<DeliveryFeeGroup> {
    return withDeliveryPricingErrors(() => this.actions.adjustPrices(ctx, groupId, input));
  }

  /** Gives every commune of one wilaya the same prices (delivery.pricing.edit, D3140). */
  @Mutation()
  @requirePermission(P.edit)
  setDeliveryFeeProvinceCommunePrices(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: unknown,
    @Args('provinceCode') provinceCode: unknown,
    @Args('input') input: unknown,
  ): Promise<DeliveryFeeGroup> {
    return withDeliveryPricingErrors(() => this.actions.setCommunePrices(ctx, groupId, provinceCode, input));
  }

  /** Copies a fee group with its wilaya and commune rows under a new name (delivery.pricing.create, D3140). */
  @Mutation()
  @requirePermission(P.create)
  duplicateDeliveryFeeGroup(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: unknown,
    @Args('name') name: unknown,
  ): Promise<DeliveryFeeGroup> {
    return withDeliveryPricingErrors(() => this.actions.duplicate(ctx, groupId, name));
  }
}
