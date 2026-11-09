import { RateLimit } from '@cod/plugin-rate-limit';
import { DomainError } from '@cod/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Allow, Permission, RequestContextService } from '@vendure/core';
import { OAuthSignInService } from '../application/oauth-sign-in.service';
import { OAUTH_BROWSER_BINDING } from '../application/tokens';
import { OAUTH_COMPLETE_PATH, OAUTH_REGISTER_PATH } from '../domain/constants';
import type { OAuthCompletion, OAuthProviderName, OAuthTicketPreview } from '../domain/oauth';
import type { OAuthBrowserBindingPort } from '../domain/ports/oauth-browser-binding.port';
import { AUTH_DASHBOARD_URL } from './auth-dashboard-url';
import type { HttpRequest, HttpResponse } from './end-current-session';
import { DomainErrorRestFilter } from './error-mapping';
import { OAuthEnabledGuard } from './oauth-enabled.guard';
import { operationOf } from './operation';
import { stringFields } from './rest-body';

/** The query of a provider's return leg; any of it can be missing or forged. */
interface CallbackQuery {
  readonly state?: unknown;
  readonly code?: unknown;
}

const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * The redirect flow (D36). Every address it redirects to comes from configuration or the provider's own settings:
 * no parameter names a destination, so there is nothing to turn into an open redirect.
 */
@Controller('auth/oauth')
@UseGuards(OAuthEnabledGuard)
@UseFilters(DomainErrorRestFilter)
export class OAuthController {
  constructor(
    private readonly signIn: OAuthSignInService,
    private readonly requestContexts: RequestContextService,
    @Inject(OAUTH_BROWSER_BINDING) private readonly binding: OAuthBrowserBindingPort,
    @Inject(AUTH_DASHBOARD_URL) private readonly dashboardUrl: string,
  ) {}

  /** Sets the browser's binding cookie and sends it to the provider. */
  @Get(':provider/start')
  @Allow(Permission.Public)
  @RateLimit('login-ip')
  start(@Param('provider') provider: string, @Res() res: HttpResponse): void {
    const { authorizeUrl, bindingValue } = this.signIn.begin(this.offered(provider));
    this.binding.write(res, bindingValue);
    res.redirect(authorizeUrl);
  }

  /** The provider's return leg: ends on the dashboard with a ticket, or with the refusal's code. */
  @Get(':provider/callback')
  @Allow(Permission.Public)
  @RateLimit('login-ip')
  async callback(
    @Param('provider') provider: string,
    @Query() query: CallbackQuery,
    @Req() req: HttpRequest,
    @Res() res: HttpResponse,
  ): Promise<void> {
    const name = this.offered(provider);
    res.redirect(await this.destinationOf(name, query, req));
  }

  /** Lets the sign-up form show a new identity's own details. Spends nothing. */
  @Post('ticket')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  @RateLimit('login-ip')
  async preview(@Body() body: unknown, @Req() req: HttpRequest): Promise<OAuthTicketPreview> {
    const { ticket } = stringFields(body, 'ticket');
    const ctx = await this.requestContexts.create({ req, apiType: 'admin' });
    return this.signIn.preview(operationOf(ctx), ticket, this.binding.read(req));
  }

  private async destinationOf(name: OAuthProviderName, query: CallbackQuery, req: HttpRequest): Promise<string> {
    try {
      const ctx = await this.requestContexts.create({ req, apiType: 'admin' });
      const params = { state: textOf(query.state), code: textOf(query.code) };
      const completion = await this.signIn.complete(operationOf(ctx), name, params, this.binding.read(req));
      return this.ticketPage(completion);
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        return this.page(OAUTH_COMPLETE_PATH, 'error', error.code);
      }
      throw error;
    }
  }

  private ticketPage({ destination, ticket }: OAuthCompletion): string {
    return this.page(destination === 'register' ? OAUTH_REGISTER_PATH : OAUTH_COMPLETE_PATH, 'ticket', ticket);
  }

  private page(path: string, parameter: string, value: string): string {
    return `${this.dashboardUrl.replace(/\/+$/, '')}${path}?${parameter}=${encodeURIComponent(value)}`;
  }

  private offered(provider: string): OAuthProviderName {
    if (!this.signIn.offers(provider)) {
      throw new NotFoundException();
    }
    return provider;
  }
}
