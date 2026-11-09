import { AUTH_ERROR_CODES } from '@cod/shared';
import { type AuthenticationStrategy, type Injector, type RequestContext, type User, UserService } from '@vendure/core';
import gql from 'graphql-tag';
import { OAuthSignInService } from '../application/oauth-sign-in.service';
import { OAUTH_BROWSER_BINDING } from '../application/tokens';
import { OAUTH_STRATEGY_NAME } from '../domain/constants';
import { InvalidTokenError } from '../domain/errors';
import type { OAuthBrowserBindingPort } from '../domain/ports/oauth-browser-binding.port';
import type { OperationContext } from '../domain/ports/operation-context';

/** The `authenticate` input of this strategy. */
export interface OAuthAuthenticationData {
  readonly ticket: string;
}

const NO_REQUEST = { headers: {} };

/**
 * Spends the ticket the OAuth callback issued (D36). There is no `onLogOut`: the session is ours alone and nothing
 * is held at the provider, so a logout has nothing to tell it.
 */
export class OAuthAuthenticationStrategy implements AuthenticationStrategy<OAuthAuthenticationData> {
  readonly name = OAUTH_STRATEGY_NAME;
  private signIn!: OAuthSignInService;
  private users!: UserService;
  private binding!: OAuthBrowserBindingPort;

  init(injector: Injector): void {
    this.signIn = injector.get(OAuthSignInService);
    this.users = injector.get(UserService);
    this.binding = injector.get<OAuthBrowserBindingPort>(OAUTH_BROWSER_BINDING);
  }

  defineInputType(): ReturnType<AuthenticationStrategy['defineInputType']> {
    return gql`
      input OAuthAuthInput {
        ticket: String!
      }
    `;
  }

  async authenticate(ctx: RequestContext, data: OAuthAuthenticationData): Promise<User | string> {
    try {
      const binding = this.binding.read(ctx.req ?? NO_REQUEST);
      const userId = await this.signIn.signIn(ctx as unknown as OperationContext, data.ticket, binding);
      const user = await this.users.getUserById(ctx, userId);
      if (user === undefined) {
        return AUTH_ERROR_CODES.INVALID_TOKEN;
      }
      if (ctx.req?.res !== undefined) {
        this.binding.clear(ctx.req.res);
      }
      return user;
    } catch (error: unknown) {
      if (error instanceof InvalidTokenError) {
        return AUTH_ERROR_CODES.INVALID_TOKEN;
      }
      throw error;
    }
  }
}
