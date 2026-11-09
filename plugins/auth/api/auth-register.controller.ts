import { RateLimit } from '@cod/plugin-rate-limit';
import { Body, Controller, Post, Req, UseFilters } from '@nestjs/common';
import { Allow, Permission, RequestContextService } from '@vendure/core';
import { RegisterMerchantService, type RegisterMerchantResult } from '../application/register-merchant.service';
import type { OperationContext } from '../domain/ports/operation-context';
import type { HttpRequest } from './end-current-session';
import { DomainErrorRestFilter } from './error-mapping';

/** `registerMerchant` for API clients that do not speak GraphQL (ADR 0017). */
@Controller('auth')
@UseFilters(DomainErrorRestFilter)
export class AuthRegisterController {
  constructor(
    private readonly registration: RegisterMerchantService,
    private readonly requestContexts: RequestContextService,
  ) {}

  /** Creates the account, business and first store. Opens no session. */
  @Post('register')
  @Allow(Permission.Public)
  @RateLimit('register-ip')
  async register(@Body() body: unknown, @Req() req: HttpRequest): Promise<RegisterMerchantResult> {
    // A REST request has api type `custom`; the same administrators and channels as the Admin API are meant here.
    const ctx = await this.requestContexts.create({ req, apiType: 'admin' });
    return this.registration.register(ctx as unknown as OperationContext, body);
  }
}
