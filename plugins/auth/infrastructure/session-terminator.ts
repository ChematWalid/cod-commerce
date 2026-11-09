import { Injectable } from '@nestjs/common';
import {
  API_KEY_AUTH_STRATEGY_NAME,
  AuthenticatedSession,
  ConfigService,
  EventBus,
  Logger,
  LogoutEvent,
  type RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { In, Not } from 'typeorm';
import { SESSION_CACHE_DELETE_TIMEOUT_MS } from '../domain/constants';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';

const LOG_CONTEXT = 'SessionTerminator';

const requestContextOf = (operation: OperationContext): RequestContext => operation as unknown as RequestContext;

/** Single-session deletes against Vendure's session table and session cache (D22). */
@Injectable()
export class SessionTerminator implements SessionTerminatorPort {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
  ) {}

  /** The row goes first: evicting first would let a concurrent request re-cache a session about to be deleted. */
  async endCurrent(operation: OperationContext): Promise<boolean> {
    const ctx = requestContextOf(operation);
    const { session } = ctx;
    if (session?.token === undefined || session.authenticationStrategy === API_KEY_AUTH_STRATEGY_NAME) {
      return false;
    }
    await this.connection.getRepository(ctx, AuthenticatedSession).delete({ token: session.token });
    await this.flushCache([session.token]);
    if (session.user !== undefined) {
      await this.eventBus.publish(new LogoutEvent(ctx));
    }
    return true;
  }

  async endOthers(operation: OperationContext, userId: string, keepToken: string): Promise<string[]> {
    const repository = this.connection.getRepository(requestContextOf(operation), AuthenticatedSession);
    const others = await repository.find({
      where: {
        user: { id: userId },
        token: Not(keepToken),
        authenticationStrategy: Not(API_KEY_AUTH_STRATEGY_NAME),
      },
    });
    if (others.length > 0) {
      await repository.delete({ id: In(others.map((other) => other.id)) });
    }
    return others.map((other) => other.token);
  }

  async flushCache(tokens: readonly string[]): Promise<void> {
    await Promise.all(tokens.map((token) => this.evict(token)));
  }

  /** Never throws: the row is already gone, so the worst case is the cache TTL, which the log makes visible. */
  private async evict(token: string): Promise<void> {
    const { sessionCacheStrategy } = this.configService.authOptions;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timed out'));
      }, SESSION_CACHE_DELETE_TIMEOUT_MS);
    });
    try {
      await Promise.race([Promise.resolve(sessionCacheStrategy.delete(token)), timeout]);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      Logger.error(`Session cache delete failed, the session lives until the cache TTL: ${reason}`, LOG_CONTEXT);
    } finally {
      clearTimeout(timer);
    }
  }
}
