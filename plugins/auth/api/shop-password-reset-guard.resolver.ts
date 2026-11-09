import { RateLimit } from '@cod/plugin-rate-limit';
import { normalizeEmail } from '@cod/shared';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, CustomerService, Permission, type RequestContext, Transaction } from '@vendure/core';
import { ACCOUNT_IDENTITY } from '../application/tokens';
import type { AccountIdentityPort } from '../domain/ports/account-identity.port';
import { operationOf } from './operation';

interface SuccessResult {
  readonly success: boolean;
}

const SUCCESS: SuccessResult = { success: true };

/**
 * Shadows the Shop API `requestPasswordReset` (D21). For an administrator the stock one stores a plaintext token,
 * publishes `PasswordResetEvent` and then fails for want of a customer, which also reveals that the email exists.
 * An administrator's email now gets the answer of an unknown one; customers keep the stock behaviour.
 */
@Resolver()
export class ShopPasswordResetGuardResolver {
  constructor(
    private readonly customers: CustomerService,
    @Inject(ACCOUNT_IDENTITY) private readonly identity: Pick<AccountIdentityPort, 'findByEmail'>,
  ) {}

  /** Starts a customer's password reset. Always answers success. */
  @Transaction()
  @Mutation()
  @Allow(Permission.Public)
  @RateLimit('reset-ip')
  async requestPasswordReset(
    @Ctx() ctx: RequestContext,
    @Args('emailAddress') emailAddress: string,
  ): Promise<SuccessResult> {
    const administrator = await this.identity.findByEmail(operationOf(ctx), normalizeEmail(emailAddress));
    if (administrator === undefined) {
      await this.customers.requestPasswordReset(ctx, emailAddress);
    }
    return SUCCESS;
  }
}
