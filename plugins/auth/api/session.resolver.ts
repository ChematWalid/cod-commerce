import { Inject } from '@nestjs/common';
import { Context, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, ConfigService, Ctx, Permission, type RequestContext } from '@vendure/core';
import { SESSION_TERMINATOR } from '../application/tokens';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import { endCurrentSession, type HttpRequest, type HttpResponse, type LogoutResult } from './end-current-session';

/**
 * Shadows the stock `logout`, which ends every session of the user (D21). Plugin API modules are walked after
 * the core resolvers and the last resolver of a field wins; `session.int.test.ts` pins that order.
 *
 * Deliberately no `@Transaction`: the row must be committed before the cache eviction, or a concurrent request
 * could re-cache the session from the still-visible row.
 */
@Resolver()
export class SessionResolver {
  constructor(
    @Inject(SESSION_TERMINATOR) private readonly terminator: SessionTerminatorPort,
    private readonly configService: ConfigService,
  ) {}

  /** Ends the calling session only. */
  @Mutation()
  @Allow(Permission.Public)
  logout(
    @Ctx() ctx: RequestContext,
    @Context('req') req: HttpRequest,
    @Context('res') res: HttpResponse,
  ): Promise<LogoutResult> {
    return endCurrentSession(this.terminator, this.configService, ctx, { req, res });
  }
}
