import { RateLimit } from '@cod/plugin-rate-limit';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import { ChangeEmailService } from '../application/change-email.service';
import {
  type AccountStatus,
  EmailVerificationService,
  type ResendResult,
} from '../application/email-verification.service';
import { withApiErrors } from './error-mapping';
import { activeUserIdOf, operationOf, sessionTokenOf } from './operation';

interface SuccessResult {
  readonly success: boolean;
}

const SUCCESS: SuccessResult = { success: true };

/**
 * Email verification and email change. Deliberately no `@Transaction`: `verifyEmailOtp` must commit each guess by
 * itself, and the services open their own transactions where one is needed.
 */
@Resolver()
export class AccountEmailResolver {
  constructor(
    private readonly verification: EmailVerificationService,
    private readonly emailChange: ChangeEmailService,
  ) {}

  /** Verifies the email with the emailed link's token. */
  @Mutation()
  @Allow(Permission.Public)
  @RateLimit('token-redeem-ip')
  async verifyEmail(@Ctx() ctx: RequestContext, @Args('token') token: string): Promise<SuccessResult> {
    await withApiErrors(() => this.verification.verifyByLink(operationOf(ctx), token));
    return SUCCESS;
  }

  /** Verifies the caller's email with the emailed code. */
  @Mutation()
  @Allow(Permission.Owner)
  @RateLimit('otp-ip')
  async verifyEmailOtp(@Ctx() ctx: RequestContext, @Args('code') code: string): Promise<SuccessResult> {
    await withApiErrors(() => this.verification.verifyByCode(operationOf(ctx), activeUserIdOf(ctx), code));
    return SUCCESS;
  }

  /** Sends a new link and code, at most once per cooldown. */
  @Mutation()
  @Allow(Permission.Owner)
  resendEmailVerification(@Ctx() ctx: RequestContext): Promise<ResendResult> {
    return withApiErrors(() => this.verification.resend(operationOf(ctx), activeUserIdOf(ctx)));
  }

  /** The verification banner's only source. */
  @Query()
  @Allow(Permission.Owner)
  accountStatus(@Ctx() ctx: RequestContext): Promise<AccountStatus> {
    return withApiErrors(() => this.verification.status(operationOf(ctx), activeUserIdOf(ctx)));
  }

  /** Mails a confirmation to the new address; nothing switches until it is used. */
  @Mutation()
  @Allow(Permission.Owner)
  @RateLimit('current-password-ip')
  async requestEmailChange(
    @Ctx() ctx: RequestContext,
    @Args('newEmail') newEmail: string,
    @Args('currentPassword') currentPassword: string,
  ): Promise<SuccessResult> {
    const command = { userId: activeUserIdOf(ctx), newEmail, currentPassword };
    await withApiErrors(() => this.emailChange.request(operationOf(ctx), command));
    return SUCCESS;
  }

  /** Switches the account to the confirmed address. */
  @Mutation()
  @Allow(Permission.Public)
  @RateLimit('token-redeem-ip')
  async confirmEmailChange(@Ctx() ctx: RequestContext, @Args('token') token: string): Promise<SuccessResult> {
    await withApiErrors(() => this.emailChange.confirm(operationOf(ctx), token, sessionTokenOf(ctx)));
    return SUCCESS;
  }
}
