import { RateLimit } from '@cod/plugin-rate-limit';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  ConfigService,
  Ctx,
  PasswordResetTokenInvalidError,
  PasswordValidationError,
  Permission,
  type RequestContext,
  setSessionToken,
} from '@vendure/core';
import { ChangePasswordService } from '../application/change-password.service';
import { PasswordResetService } from '../application/password-reset.service';
import { InvalidTokenError, PasswordPolicyError } from '../domain/errors';
import type { OpenedSession } from '../domain/ports/account-credentials.port';
import type { HttpRequest, HttpResponse } from './end-current-session';
import { withApiErrors } from './error-mapping';
import { activeUserIdOf, operationOf, sessionTokenOf } from './operation';

interface SuccessResult {
  readonly success: boolean;
}

interface HttpExchange {
  readonly req: HttpRequest;
  readonly res: HttpResponse;
}

type ResetResult = Omit<OpenedSession, 'token'> | PasswordResetTokenInvalidError | PasswordValidationError;

const SUCCESS: SuccessResult = { success: true };

/** The stock reset page reads these union members, so the refusals stay in the stock shape. */
function resetRefusal(error: unknown): PasswordResetTokenInvalidError | PasswordValidationError {
  if (error instanceof InvalidTokenError) {
    return new PasswordResetTokenInvalidError();
  }
  if (error instanceof PasswordPolicyError) {
    return new PasswordValidationError({ validationErrorMessage: error.message });
  }
  throw error;
}

/**
 * Shadows the stock `requestPasswordReset` and `resetPassword`, which keep the token in plaintext (D21). No
 * `@Transaction`: the cache flush and the session opening must follow the commit.
 */
@Resolver()
export class PasswordResolver {
  constructor(
    private readonly reset: PasswordResetService,
    private readonly change: ChangePasswordService,
    private readonly configService: ConfigService,
  ) {}

  /** Always answers success, so it cannot reveal which emails have accounts. */
  @Mutation()
  @Allow(Permission.Public)
  @RateLimit('reset-ip')
  async requestPasswordReset(
    @Ctx() ctx: RequestContext,
    @Args('emailAddress') emailAddress: string,
  ): Promise<SuccessResult> {
    await withApiErrors(() => this.reset.request(operationOf(ctx), emailAddress));
    return SUCCESS;
  }

  /** Sets a new password with an emailed token and signs the owner in. */
  @Mutation()
  @Allow(Permission.Public)
  @RateLimit('token-redeem-ip')
  async resetPassword(
    @Ctx() ctx: RequestContext,
    @Args('token') token: string,
    @Args('password') password: string,
    @Context() { req, res }: HttpExchange,
  ): Promise<ResetResult> {
    try {
      const { token: sessionToken, ...user } = await this.reset.reset(operationOf(ctx), token, password);
      setSessionToken({ req, res, authOptions: this.configService.authOptions, rememberMe: false, sessionToken });
      return user;
    } catch (error: unknown) {
      return resetRefusal(error);
    }
  }

  /** Changes the caller's password and ends the caller's other sessions. */
  @Mutation()
  @Allow(Permission.Owner)
  @RateLimit('current-password-ip')
  async changeAccountPassword(
    @Ctx() ctx: RequestContext,
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
  ): Promise<SuccessResult> {
    const command = {
      userId: activeUserIdOf(ctx),
      currentPassword,
      newPassword,
      keepSessionToken: sessionTokenOf(ctx),
    };
    await withApiErrors(() => this.change.change(operationOf(ctx), command));
    return SUCCESS;
  }
}
