import { createHash, randomBytes } from 'node:crypto';
import type { Provider } from '@nestjs/common';
import { AccountTokenService } from '../application/account-token.service';
import { OAuthSignInService, type PkcePair } from '../application/oauth-sign-in.service';
import { OAUTH_BROWSER_BINDING, SECRET_HASHER } from '../application/tokens';
import { OAUTH_PKCE_VERIFIER_BYTES, OAUTH_STATE_SEAL_CONTEXT } from '../domain/constants';
import type { OAuthProviderName } from '../domain/oauth';
import type { ClockPort } from '../domain/ports/clock.port';
import type { OAuthProviderPort } from '../domain/ports/oauth-provider.port';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';
import { EmailClaimLock } from './email-claim-lock';
import { FacebookOAuthProvider } from './facebook-oauth-provider';
import { GoogleOAuthProvider } from './google-oauth-provider';
import { OAuthBrowserBindingCookie } from './oauth-browser-binding.cookie';
import type { OAuthProviderConfig } from './oauth-http';
import { SealedOAuthStateStore } from './oauth-state-store';
import { SEAL_KEY_LABEL, SealedPayloadCodec } from './sealed-payload';
import { VendureAccountIdentity } from './vendure-account-identity';
import { VendureExternalIdentity } from './vendure-external-identity';

/** The OAuth side of the plugin; left out while `AUTH_OAUTH_ENABLED` is false (D36). */
export interface AuthOAuthOptions {
  readonly providers: Readonly<Record<OAuthProviderName, OAuthProviderConfig>>;
  /** `Secure` on the binding cookie: everywhere but local development. */
  readonly secureCookie: boolean;
}

/** What {@link oauthProviders} needs from the plugin's options. */
interface OAuthSettings {
  readonly oauth: () => AuthOAuthOptions | undefined;
  /** The API's public address: same origin as the dashboard (D20). */
  readonly apiBaseUrl: () => string;
  readonly clock: ClockPort;
  /** `AUTH_TOKEN_SECRET`, which the `state` sealer's key derives from. */
  readonly tokenSecret: () => string;
}

function newPkce(): PkcePair {
  const verifier = randomBytes(OAUTH_PKCE_VERIFIER_BYTES).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

function adaptersOf(oauth: AuthOAuthOptions | undefined): Partial<Record<OAuthProviderName, OAuthProviderPort>> {
  if (oauth === undefined) {
    return {};
  }
  return {
    google: new GoogleOAuthProvider(oauth.providers.google),
    facebook: new FacebookOAuthProvider(oauth.providers.facebook),
  };
}

type SignInDependencies = [
  VendureAccountIdentity,
  VendureExternalIdentity,
  EmailClaimLock,
  AccountTokenService,
  SecretHasherPort,
];

/** The Nest wiring of the OAuth sign-in; `application/` stays free of Nest. */
export function oauthProviders({ oauth, apiBaseUrl, clock, tokenSecret }: OAuthSettings): Provider[] {
  return [
    VendureExternalIdentity,
    {
      provide: OAUTH_BROWSER_BINDING,
      useFactory: () => new OAuthBrowserBindingCookie(oauth()?.secureCookie ?? true),
    },
    {
      provide: OAuthSignInService,
      useFactory: (...[identity, external, claims, tokens, hasher]: SignInDependencies) =>
        new OAuthSignInService({
          providers: adaptersOf(oauth()),
          state: new SealedOAuthStateStore(
            new SealedPayloadCodec(tokenSecret(), SEAL_KEY_LABEL, OAUTH_STATE_SEAL_CONTEXT),
          ),
          identity,
          external,
          claims,
          tokens,
          hasher,
          clock,
          newPkce,
          apiBaseUrl: apiBaseUrl(),
        }),
      inject: [VendureAccountIdentity, VendureExternalIdentity, EmailClaimLock, AccountTokenService, SECRET_HASHER],
    },
  ];
}
