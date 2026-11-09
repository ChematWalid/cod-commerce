import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  AdministratorService,
  Allow,
  Ctx,
  CustomerService,
  type ErrorResult,
  ForbiddenError,
  HistoryService,
  isGraphQlErrorResult,
  Permission,
  type RequestContext,
  Transaction,
  UserService,
} from '@vendure/core';
import { UseAccountSecurityError } from './use-account-security.error';

type HistoryEntryKind = Parameters<HistoryService['createHistoryEntryForCustomer']>[0]['type'];

const PASSWORD_UPDATED = 'CUSTOMER_PASSWORD_UPDATED' as unknown as HistoryEntryKind;

interface PasswordChangeArgs {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * Shadows the Shop API `updateCustomerPassword` (D21), which any session can call. For an administrator it would skip
 * the rate limit, the voiding of open tokens and the ending of other sessions, so administrators are refused.
 * Customers keep the stock behaviour.
 */
@Resolver()
export class ShopAccountGuardResolver {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly users: UserService,
    private readonly customers: CustomerService,
    private readonly history: HistoryService,
  ) {}

  /** Changes a customer's password. */
  @Transaction()
  @Mutation()
  @Allow(Permission.Owner)
  async updateCustomerPassword(
    @Ctx() ctx: RequestContext,
    @Args() args: PasswordChangeArgs,
  ): Promise<{ readonly success: boolean } | ErrorResult> {
    const { activeUserId } = ctx;
    if (activeUserId === undefined) {
      throw new ForbiddenError();
    }
    if ((await this.administrators.findOneByUserId(ctx, activeUserId)) !== undefined) {
      throw new UseAccountSecurityError();
    }
    const result = await this.users.updatePassword(ctx, activeUserId, args.currentPassword, args.newPassword);
    if (isGraphQlErrorResult(result)) {
      return result;
    }
    const customer = await this.customers.findOneByUserId(ctx, activeUserId);
    if (customer !== undefined) {
      await this.history.createHistoryEntryForCustomer({
        ctx,
        customerId: customer.id,
        type: PASSWORD_UPDATED,
        data: {},
      });
    }
    return { success: result };
  }
}
