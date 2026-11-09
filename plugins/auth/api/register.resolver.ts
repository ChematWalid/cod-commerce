import { RateLimit } from '@cod/plugin-rate-limit';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import { RegisterMerchantService, type RegisterMerchantResult } from '../application/register-merchant.service';
import { AUTH_PUBLIC_CONFIG } from '../application/tokens';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AuthPublicConfig } from '../domain/public-config';
import { withApiErrors } from './error-mapping';

/** Sign-up and what a client must know before it. */
@Resolver()
export class RegisterResolver {
  constructor(
    private readonly registration: RegisterMerchantService,
    @Inject(AUTH_PUBLIC_CONFIG) private readonly config: AuthPublicConfig,
  ) {}

  /** Creates the account, business and first store. Opens no session. */
  @Mutation()
  @Allow(Permission.Public)
  @RateLimit('register-ip')
  registerMerchant(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<RegisterMerchantResult> {
    return withApiErrors(() => this.registration.register(ctx as unknown as OperationContext, input));
  }

  /** Which sign-in options this deployment offers. */
  @Query()
  @Allow(Permission.Public)
  authPublicConfig(): AuthPublicConfig {
    return this.config;
  }
}
