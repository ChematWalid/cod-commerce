import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseFilters } from '@nestjs/common';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import { AccountProfileService } from '../application/account-profile.service';
import type { AccountProfile } from '../domain/profile';
import { DomainErrorRestFilter } from './error-mapping';
import { activeUserIdOf, operationOf } from './operation';
import { optionalProfileFields } from './rest-body';

/** The owner's own profile for clients that do not speak GraphQL (ADR 0017). The photo upload is GraphQL's. */
@Controller('auth/profile')
@UseFilters(DomainErrorRestFilter)
export class AuthProfileController {
  constructor(private readonly profiles: AccountProfileService) {}

  @Get()
  @Allow(Permission.Owner)
  get(@Ctx() ctx: RequestContext): Promise<AccountProfile> {
    return this.profiles.get(operationOf(ctx), activeUserIdOf(ctx));
  }

  /** Fields left out of the body keep their value. */
  @Patch()
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Owner)
  update(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<AccountProfile> {
    return this.profiles.update(operationOf(ctx), activeUserIdOf(ctx), optionalProfileFields(body));
  }
}
