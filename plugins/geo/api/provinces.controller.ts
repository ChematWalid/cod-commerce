import type { Province } from '@cod/shared';
import { RateLimit } from '@cod/plugin-rate-limit';
import { Controller, Get, Param, UseFilters } from '@nestjs/common';
import { Allow, Permission } from '@vendure/core';
import { ProvinceReadService } from '../application/province-read.service';
import { CacheControl, PUBLIC_REFERENCE_CACHE_CONTROL } from './cache-control.interceptor';
import { geoRestCall, GeoRestErrorFilter } from './error-mapping';

/**
 * The wilayas and communes for anyone (D3117): reference data, the same for every buyer, so it is unauthenticated,
 * limited per client address and cacheable. A `storeId` parameter is ignored; per-store flags are signed (D3106).
 */
@Controller('provinces')
@UseFilters(GeoRestErrorFilter)
@CacheControl(PUBLIC_REFERENCE_CACHE_CONTROL)
export class ProvincesController {
  constructor(private readonly provinces: ProvinceReadService) {}

  /** Every wilaya, ordered by code, without communes. */
  @Get()
  @Allow(Permission.Public)
  @RateLimit('provinces-ip')
  list(): Promise<readonly Province[]> {
    return geoRestCall(() => this.provinces.list());
  }

  /** The wilaya of `16`, `1` or `01` with its communes; 404 `geo.province-not-found` for any other code (D3115). */
  @Get('code/:code')
  @Allow(Permission.Public)
  @RateLimit('provinces-ip')
  byCode(@Param('code') code: string): Promise<Province> {
    return geoRestCall(() => this.provinces.byCode(code));
  }
}
