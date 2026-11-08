import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Allow, Permission } from '@vendure/core';
import { ResolveHostService } from '../application/resolve-host.service';
import type { StoreResolution } from '../domain/store-resolution';

function orNotFound(resolution: StoreResolution | null): StoreResolution {
  if (resolution === null) throw new NotFoundException();
  return resolution;
}

/** What the storefront asks about a store. Public: buyers have no session, and only public fields leave. */
@Controller('store')
export class StoreResolveController {
  constructor(private readonly hosts: ResolveHostService) {}

  /** The store behind a host, or 404: a malformed host is an unknown one, never a 400. */
  @Get('resolve')
  @Allow(Permission.Public)
  async resolve(@Query('host') host: unknown): Promise<StoreResolution> {
    return orNotFound(await this.hosts.resolve(host));
  }

  /** The active store with this id, or 404. */
  @Get('by-id/:storeId')
  @Allow(Permission.Public)
  async byId(@Param('storeId') storeId: string): Promise<StoreResolution> {
    return orNotFound(await this.hosts.findById(storeId));
  }
}
