import { type ConfigService, type RequestContext, setSessionToken } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';

type SessionTokenOptions = Parameters<typeof setSessionToken>[0];

/** The Express request, named through Vendure so the plugin needs no Express dependency of its own. */
export type HttpRequest = SessionTokenOptions['req'];

/** The Express response; see {@link HttpRequest}. */
export type HttpResponse = SessionTokenOptions['res'];

/** What both logout endpoints answer. */
export interface LogoutResult {
  readonly success: boolean;
}

/** Ends the caller's session and clears its cookie (D22); shared by the GraphQL and REST logouts. */
export async function endCurrentSession(
  terminator: SessionTerminatorPort,
  configService: ConfigService,
  ctx: RequestContext,
  http: { readonly req: HttpRequest; readonly res: HttpResponse },
): Promise<LogoutResult> {
  const ended = await terminator.endCurrent(ctx as unknown as OperationContext);
  if (ended) {
    const { authOptions } = configService;
    setSessionToken({ ...http, authOptions, rememberMe: false, sessionToken: '' });
  }
  return { success: ended };
}
