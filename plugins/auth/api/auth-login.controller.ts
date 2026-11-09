import { RateLimitedFilter } from '@cod/plugin-rate-limit';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import {
  Allow,
  AuthService,
  ConfigService,
  Ctx,
  isGraphQlErrorResult,
  NATIVE_AUTH_STRATEGY_NAME,
  Permission,
  type RequestContext,
  RequestContextService,
  setSessionToken,
} from '@vendure/core';
import { SESSION_TERMINATOR } from '../application/tokens';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import { endCurrentSession, type HttpRequest, type HttpResponse, type LogoutResult } from './end-current-session';

/** What `POST /auth/login` answers. */
export interface RestLoginResult {
  readonly id: string;
  readonly identifier: string;
}

interface Credentials {
  readonly username: string;
  readonly password: string;
}

function isCredentials(body: unknown): body is Credentials {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const { username, password } = body as Partial<Record<keyof Credentials, unknown>>;
  return typeof username === 'string' && typeof password === 'string';
}

/** Login and logout for API clients that do not speak GraphQL (ADR 0017). */
@Controller('auth')
@UseFilters(RateLimitedFilter)
export class AuthLoginController {
  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
    private readonly requestContexts: RequestContextService,
    @Inject(SESSION_TERMINATOR) private readonly terminator: SessionTerminatorPort,
  ) {}

  /** Signs an administrator in; the token comes back in the session header and cookie. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  async login(
    @Body() body: unknown,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<RestLoginResult> {
    if (!isCredentials(body)) {
      throw new BadRequestException('username and password are required');
    }
    // A REST request has api type `custom`, under which the password check would look for a customer.
    const ctx = await this.requestContexts.create({ req, apiType: 'admin' });
    const { username, password } = body;
    const session = await this.auth.authenticate(ctx, 'admin', NATIVE_AUTH_STRATEGY_NAME, { username, password });
    if (isGraphQlErrorResult(session)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { authOptions } = this.configService;
    setSessionToken({ req, res, authOptions, rememberMe: false, sessionToken: session.token });
    return { id: String(session.user.id), identifier: session.user.identifier };
  }

  /** Ends the calling session only (D22). */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Allow(Permission.Public)
  logout(
    @Ctx() ctx: RequestContext,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<LogoutResult> {
    return endCurrentSession(this.terminator, this.configService, ctx, { req, res });
  }
}
