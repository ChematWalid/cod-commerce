import { RateLimit } from '@cod/plugin-rate-limit';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseFilters } from '@nestjs/common';
import {
  Allow,
  ConfigService,
  Ctx,
  Permission,
  type RequestContext,
  RequestContextService,
  setSessionToken,
} from '@vendure/core';
import { ChangePasswordService } from '../application/change-password.service';
import { PasswordResetService } from '../application/password-reset.service';
import type { OperationContext } from '../domain/ports/operation-context';
import type { HttpRequest, HttpResponse } from './end-current-session';
import { DomainErrorRestFilter } from './error-mapping';
import { activeUserIdOf, operationOf, sessionTokenOf } from './operation';
import { stringFields } from './rest-body';

interface SuccessResult {
  readonly success: boolean;
}

/** What `POST /auth/reset-password` answers, as `POST /auth/login` does. */
export interface RestResetResult {
  readonly id: string;
  readonly identifier: string;
}

const SUCCESS: SuccessResult = { success: true };

/** Forgot, reset and change password for clients that do not speak GraphQL (ADR 0017). */
@Controller('auth')
@UseFilters(DomainErrorRestFilter)
export class AuthPasswordController {
  constructor(
    private readonly reset: PasswordResetService,
    private readonly changes: ChangePasswordService,
    private readonly requestContexts: RequestContextService,
    private readonly configService: ConfigService,
  ) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  @RateLimit('reset-ip')
  async forgotPassword(@Body() body: unknown, @Req() req: HttpRequest): Promise<SuccessResult> {
    const { email } = stringFields(body, 'email');
    await this.reset.request(await this.adminContext(req), email);
    return SUCCESS;
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  @RateLimit('token-redeem-ip')
  async resetPassword(
    @Body() body: unknown,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<RestResetResult> {
    const { token, password } = stringFields(body, 'token', 'password');
    const session = await this.reset.reset(await this.adminContext(req), token, password);
    const { authOptions } = this.configService;
    setSessionToken({ req, res, authOptions, rememberMe: false, sessionToken: session.token });
    return { id: session.id, identifier: session.identifier };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Owner)
  @RateLimit('current-password-ip')
  async changePassword(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<SuccessResult> {
    const { currentPassword, newPassword } = stringFields(body, 'currentPassword', 'newPassword');
    await this.changes.change(operationOf(ctx), {
      userId: activeUserIdOf(ctx),
      currentPassword,
      newPassword,
      keepSessionToken: sessionTokenOf(ctx),
    });
    return SUCCESS;
  }

  /** A REST request has api type `custom`; the same administrators as the Admin API are meant here. */
  private async adminContext(req: HttpRequest): Promise<OperationContext> {
    return operationOf(await this.requestContexts.create({ req, apiType: 'admin' }));
  }
}
