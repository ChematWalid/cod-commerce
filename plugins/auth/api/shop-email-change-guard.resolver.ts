import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  AdministratorService,
  Allow,
  AuthService,
  ConfigService,
  Ctx,
  CustomerService,
  type ErrorResult,
  ForbiddenError,
  isGraphQlErrorResult,
  NATIVE_AUTH_STRATEGY_NAME,
  NativeAuthStrategyError,
  Permission,
  type RequestContext,
  Transaction,
} from '@vendure/core';
import { UseAccountSecurityError } from './use-account-security.error';

interface EmailChangeRequestArgs {
  readonly password: string;
  readonly newEmailAddress: string;
}

/**
 * Shadows the Shop API `requestUpdateCustomerEmailAddress` (D51), which any session can call and which answers whether
 * a password is right with no limit at all. Administrators are refused before any password is looked at; customers
 * keep the stock behaviour.
 */
@Resolver()
export class ShopEmailChangeGuardResolver {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly customers: CustomerService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Asks to move a customer's account to another email. */
  @Transaction()
  @Mutation()
  @Allow(Permission.Owner)
  async requestUpdateCustomerEmailAddress(
    @Ctx() ctx: RequestContext,
    @Args() args: EmailChangeRequestArgs,
  ): Promise<{ readonly success: boolean } | ErrorResult> {
    const { activeUserId } = ctx;
    if (activeUserId === undefined) {
      throw new ForbiddenError();
    }
    if ((await this.administrators.findOneByUserId(ctx, activeUserId)) !== undefined) {
      throw new UseAccountSecurityError();
    }
    if (!this.config.authOptions.shopAuthenticationStrategy.some(({ name }) => name === NATIVE_AUTH_STRATEGY_NAME)) {
      return new NativeAuthStrategyError();
    }
    const verified = await this.auth.verifyUserPassword(ctx, activeUserId, args.password);
    if (isGraphQlErrorResult(verified)) {
      return verified;
    }
    const result = await this.customers.requestUpdateEmailAddress(ctx, activeUserId, args.newEmailAddress);
    return isGraphQlErrorResult(result) ? result : { success: result };
  }
}
