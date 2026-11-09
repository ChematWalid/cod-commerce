import { Injectable } from '@nestjs/common';
import {
  AuthService,
  isGraphQlErrorResult,
  NATIVE_AUTH_STRATEGY_NAME,
  type RequestContext,
  SessionService,
  User,
  UserService,
} from '@vendure/core';
import type { AccountSessionsPort, OpenedSession } from '../domain/ports/account-credentials.port';
import type { OperationContext } from '../domain/ports/operation-context';

const requestContextOf = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** {@link AccountSessionsPort} on Vendure's sessions. */
@Injectable()
export class VendureAccountSessions implements AccountSessionsPort {
  constructor(
    private readonly users: UserService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  async endAll(operation: OperationContext, userId: number): Promise<void> {
    const ctx = requestContextOf(operation);
    await this.sessions.deleteSessionsByUser(ctx, new User({ id: userId }));
  }

  /** Not through the login strategy: its lockout must not stand between a proven owner and the account. */
  async open(operation: OperationContext, userId: number): Promise<OpenedSession> {
    const ctx = requestContextOf(operation);
    const user = await this.users.getUserById(ctx, userId);
    if (user === undefined) {
      throw new Error('The account no longer exists');
    }
    const session = await this.auth.createAuthenticatedSessionForUser(ctx, user, NATIVE_AUTH_STRATEGY_NAME, 'admin');
    if (isGraphQlErrorResult(session)) {
      throw new Error(`The session could not be opened: ${String(session.errorCode)}`);
    }
    const cached = await this.sessions.getSessionFromToken(session.token);
    return {
      token: session.token,
      id: String(user.id),
      identifier: user.identifier,
      channels: cached?.user?.channelPermissions ?? [],
    };
  }
}
