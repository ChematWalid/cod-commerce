import { OAuthFailedError } from '../domain/errors';
import type { OAuthIdentity } from '../domain/oauth';
import type { OAuthProviderPort } from '../domain/ports/oauth-provider.port';
import { buildAuthorizeUrl, exchangeCode, fetchProfile, type OAuthProviderConfig, textField } from './oauth-http';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPE = 'openid email profile';

/** Google's OpenID Connect code flow. */
export class GoogleOAuthProvider implements OAuthProviderPort {
  constructor(private readonly config: OAuthProviderConfig) {}

  authorizeUrl(state: string, codeChallenge: string, redirectUri: string): string {
    return buildAuthorizeUrl(this.config.authorizeUrl ?? AUTHORIZE_URL, {
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
      code_challenge: codeChallenge,
    });
  }

  async exchange(code: string, codeVerifier: string, redirectUri: string): Promise<OAuthIdentity> {
    const tokenUrl = this.config.tokenUrl ?? TOKEN_URL;
    const accessToken = await exchangeCode(tokenUrl, this.config, { code, codeVerifier, redirectUri });
    const profile = await fetchProfile(this.config.userInfoUrl ?? USER_INFO_URL, accessToken);
    const subject = textField(profile, 'sub');
    if (subject === undefined) {
      throw new OAuthFailedError();
    }
    return {
      provider: 'google',
      subject,
      email: textField(profile, 'email') ?? null,
      emailVerified: profile['email_verified'] === true,
      firstName: textField(profile, 'given_name') ?? '',
      lastName: textField(profile, 'family_name') ?? '',
    };
  }
}
