import { RateLimit } from '@cod/plugin-rate-limit';
import { StorefrontCtx, StorefrontScoped } from '@cod/plugin-tenancy';
import type { ShippingQuote } from '@cod/shared';
import { Body, Controller, Header, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { Allow, Permission, type RequestContext } from '@vendure/core';
import { ShippingQuoteUseCase } from '../application/shipping-quote.use-case';
import { QUOTE_CACHE_CONTROL } from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import { StorefrontQuoteErrorFilter } from './quote-error-mapping';

/**
 * The storefront's public quotes (P3.S3), under `/store`, which the internal-only middleware signs (D111): every
 * handler runs as the signed, active store and never reads a store, a channel or a waiver from the body (D3301,
 * D3303). Public: buyers have no session. Limited per buyer address, or per store when the signature names none
 * (D3302). Answers are one buyer's, priced now, so nothing caches them.
 */
@Controller('store')
@StorefrontScoped()
@UseFilters(StorefrontQuoteErrorFilter)
export class StorefrontQuoteController {
  constructor(private readonly shipping: ShippingQuoteUseCase) {}

  /** The store's delivery fee for a wilaya, an optional commune, home or desk, and the cart's products (D3301). */
  @Post('shipping-quote')
  @Allow(Permission.Public)
  @RateLimit('storefront-quote')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', QUOTE_CACHE_CONTROL)
  shippingQuote(@StorefrontCtx() ctx: RequestContext, @Body() body: unknown): Promise<ShippingQuote> {
    return this.shipping.quote(asOperationContext(ctx), body);
  }
}
