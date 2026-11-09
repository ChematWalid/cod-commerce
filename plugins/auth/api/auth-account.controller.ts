import { RateLimit } from '@cod/plugin-rate-limit';
import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseFilters } from '@nestjs/common';
import { Allow, Ctx, Permission, type RequestContext, RequestContextService } from '@vendure/core';
import { ChangeEmailService } from '../application/change-email.service';
import { EmailVerificationService } from '../application/email-verification.service';
import type { OperationContext } from '../domain/ports/operation-context';
import type { HttpRequest } from './end-current-session';
import { DomainErrorRestFilter } from './error-mapping';
import { activeUserIdOf, operationOf } from './operation';
import { stringFields } from './rest-body';

interface SuccessResult {
  readonly success: boolean;
}

const SUCCESS: SuccessResult = { success: true };

/** Email verification and email change for clients that do not speak GraphQL (ADR 0017). */
@Controller('auth')
@UseFilters(DomainErrorRestFilter)
export class AuthAccountController {
  constructor(
    private readonly verification: EmailVerificationService,
    private readonly emailChange: ChangeEmailService,
    private readonly requestContexts: RequestContextService,
  ) {}

  /** POST only: a mail scanner's GET must not spend the token (Review Focus 1). */
  @Post('verify-email/:token')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  async verifyEmail(@Param('token') token: string, @Req() req: HttpRequest): Promise<SuccessResult> {
    await this.verification.verifyByLink(await this.adminContext(req), token);
    return SUCCESS;
  }

  @Post('verify-email-otp')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Owner)
  @RateLimit('otp-ip')
  async verifyEmailOtp(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<SuccessResult> {
    const { code } = stringFields(body, 'code');
    await this.verification.verifyByCode(operationOf(ctx), activeUserIdOf(ctx), code);
    return SUCCESS;
  }

  @Post('change-email-request')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Owner)
  @RateLimit('current-password-ip')
  async changeEmailRequest(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<SuccessResult> {
    const { newEmail, currentPassword } = stringFields(body, 'newEmail', 'currentPassword');
    await this.emailChange.request(operationOf(ctx), { userId: activeUserIdOf(ctx), newEmail, currentPassword });
    return SUCCESS;
  }

  @Post('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  async confirmEmailChange(@Body() body: unknown, @Req() req: HttpRequest): Promise<SuccessResult> {
    const { token } = stringFields(body, 'token');
    await this.emailChange.confirm(await this.adminContext(req), token);
    return SUCCESS;
  }

  /** A REST request has api type `custom`; the same administrators as the Admin API are meant here. */
  private async adminContext(req: HttpRequest): Promise<OperationContext> {
    return operationOf(await this.requestContexts.create({ req, apiType: 'admin' }));
  }
}
