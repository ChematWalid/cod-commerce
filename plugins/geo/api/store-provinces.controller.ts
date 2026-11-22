import type { Province } from '@cod/shared';
import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { Allow, Permission } from '@vendure/core';
import { ProvinceReadService } from '../application/province-read.service';
import { CacheControl, PRIVATE_NO_STORE_CACHE_CONTROL } from './cache-control.interceptor';
import { geoRestCall, GeoRestErrorFilter } from './error-mapping';

/**
 * The wilayas and communes as one store offers them, for the storefront server (D3106). Under `/store`, which the
 * internal-only guard opens to signed callers alone (D112), so it is not limited per address and is no store-id
 * oracle; `@Allow(Permission.Public)` because the caller is the storefront, not a session.
 */
@Controller('store/provinces')
@UseFilters(GeoRestErrorFilter)
@CacheControl(PRIVATE_NO_STORE_CACHE_CONTROL)
export class StoreProvincesController {
  constructor(private readonly provinces: ProvinceReadService) {}

  /** Every wilaya for a served store; 404 `geo.store-not-found` for any other `storeId`. */
  @Get()
  @Allow(Permission.Public)
  list(@Query('storeId') storeId: unknown): Promise<readonly Province[]> {
    return geoRestCall(() => this.provinces.listForStore(storeId));
  }

  /** The wilaya with its communes' flags narrowed by the store's delivery fee table (P3.S1 Task 8). */
  @Get('code/:code')
  @Allow(Permission.Public)
  byCode(@Query('storeId') storeId: unknown, @Param('code') code: string): Promise<Province> {
    return geoRestCall(() => this.provinces.byCodeForStore(storeId, code));
  }
}
