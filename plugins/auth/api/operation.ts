import { ForbiddenError, type RequestContext } from '@vendure/core';
import { accountUserId } from '../domain/account-user-id';
import type { OperationContext } from '../domain/ports/operation-context';

/** The caller's context as the inner layers take it. */
export const operationOf = (ctx: RequestContext): OperationContext => ctx as unknown as OperationContext;

/** The signed-in user. No account handler takes a user id from its input. @throws ForbiddenError when anonymous. */
export function activeUserIdOf(ctx: RequestContext): number {
  if (ctx.activeUserId === undefined) {
    throw new ForbiddenError();
  }
  return accountUserId(ctx.activeUserId);
}

/** The session a password change keeps. */
export const sessionTokenOf = (ctx: RequestContext): string => ctx.session?.token ?? '';
