import { OAuthFailedError } from '../domain/errors';
import type { OAuthIdentity } from '../domain/oauth';
import type { OAuthProviderPort } from '../domain/ports/oauth-provider.port';
import { buildAuthorizeUrl, exchangeCode, fetchProfile, type OAuthProviderConfig, textField } from './oauth-http';

const GRAPH_VERSION = 'v21.0';
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const USER_INFO_URL = `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,email,first_name,last_name`;
const SCOPE = 'email,public_profile';

/** Facebook Login's code flow. */
export class FacebookOAuthProvider implements OAuthProviderPort {
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

  /**
   * `emailVerified` is always false: the Graph API has no field stating that the person controls the address, and
   * D36 links an account only when the provider confirms it. A Facebook sign-in therefore never links by email.
   */
  async exchange(code: string, codeVerifier: string, redirectUri: string): Promise<OAuthIdentity> {
    const tokenUrl = this.config.tokenUrl ?? TOKEN_URL;
    const accessToken = await exchangeCode(tokenUrl, this.config, { code, codeVerifier, redirectUri });
    const profile = await fetchProfile(this.config.userInfoUrl ?? USER_INFO_URL, accessToken);
    const subject = textField(profile, 'id');
    if (subject === undefined) {
      throw new OAuthFailedError();
    }
    return {
      provider: 'facebook',
      subject,
      email: textField(profile, 'email') ?? null,
      emailVerified: false,
      firstName: textField(profile, 'first_name') ?? '',
      lastName: textField(profile, 'last_name') ?? '',
    };
  }
}
