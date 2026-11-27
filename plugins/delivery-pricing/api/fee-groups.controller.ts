import { requirePermission } from '@cod/plugin-rbac/guard';
import type { DeliveryFeeGroup, DeliveryFeeGroupPage } from '@cod/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { DeliveryFeeGroupNotFoundError } from '../domain/errors';
import { DeliveryPricingRestErrorFilter, restCall } from './error-mapping';
import { FeeGroupActions } from './fee-group-actions';
import { DELIVERY_PRICING_PERMISSIONS as P } from './permissions';
import { fieldOf } from './request-body';

/** The answer of a delete. */
interface SuccessDto {
  readonly success: true;
}

/** The active store's fee groups for clients that do not speak GraphQL (ADR 0017, D2102). */
@Controller('delivery-fees')
@UseFilters(DeliveryPricingRestErrorFilter)
export class FeeGroupsController {
  constructor(private readonly actions: FeeGroupActions) {}

  /** A page of the store's groups (delivery.pricing.view); the query string is the list input. */
  @Get()
  @requirePermission(P.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<DeliveryFeeGroupPage> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** One group of the store (delivery.pricing.view); 404 `delivery-pricing.not-found` otherwise. */
  @Get(':id')
  @requirePermission(P.view)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<DeliveryFeeGroup> {
    return restCall(async () => {
      const group = await this.actions.get(ctx, id);
      if (group === null) throw new DeliveryFeeGroupNotFoundError();
      return group;
    });
  }

  /** Creates a group (delivery.pricing.create); 201 with the group. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(P.create)
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<DeliveryFeeGroup> {
    return restCall(() => this.actions.create(ctx, body));
  }

  /** Replaces a group's settings and wilaya rates (delivery.pricing.edit). */
  @Put(':id')
  @requirePermission(P.edit)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<DeliveryFeeGroup> {
    return restCall(() => this.actions.update(ctx, id, body));
  }

  /** Merges the communes of one wilaya; the body is `{ rows }` (delivery.pricing.edit, D3125). */
  @Put(':id/communes/:provinceCode')
  @requirePermission(P.edit)
  setCommuneRates(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('provinceCode') provinceCode: string,
    @Body() body: unknown,
  ): Promise<DeliveryFeeGroup> {
    return restCall(() => this.actions.setCommuneRates(ctx, id, provinceCode, fieldOf(body, 'rows')));
  }

  /** "Raise/lower by…" the selected wilayas; the body is the adjustment (delivery.pricing.edit, D3140). */
  @Post(':id/adjust')
  @HttpCode(HttpStatus.OK)
  @requirePermission(P.edit)
  adjustPrices(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<DeliveryFeeGroup> {
    return restCall(() => this.actions.adjustPrices(ctx, id, body));
  }

  /** One price for every commune of a wilaya; the body is `{ homePrice?, deskPrice? }` (delivery.pricing.edit). */
  @Put(':id/communes/:provinceCode/prices')
  @requirePermission(P.edit)
  setCommunePrices(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('provinceCode') provinceCode: string,
    @Body() body: unknown,
  ): Promise<DeliveryFeeGroup> {
    return restCall(() => this.actions.setCommunePrices(ctx, id, provinceCode, body));
  }

  /** Copies a group; the body is `{ name }` (delivery.pricing.create, D3140); 201 with the copy. */
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(P.create)
  duplicate(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<DeliveryFeeGroup> {
    return restCall(() => this.actions.duplicate(ctx, id, fieldOf(body, 'name')));
  }

  /** Deletes a group (delivery.pricing.delete); 409 `delivery-pricing.group-in-use` for a default (D3108). */
  @Delete(':id')
  @requirePermission(P.delete)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessDto> {
    await restCall(() => this.actions.delete(ctx, id));
    return { success: true };
  }
}
