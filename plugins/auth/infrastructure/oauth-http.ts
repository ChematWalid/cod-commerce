import { Logger } from '@vendure/core';
import { OAUTH_HTTP_TIMEOUT_MS } from '../domain/constants';
import { OAuthFailedError } from '../domain/errors';

const LOG_CONTEXT = 'OAuthProvider';

/** The endpoints and client of one provider. The URLs default to the provider's own. */
export interface OAuthProviderConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizeUrl?: string | undefined;
  readonly tokenUrl?: string | undefined;
  readonly userInfoUrl?: string | undefined;
}

/** A JSON object answered by a provider; its fields are read through {@link textField}. */
export type ProviderJson = Readonly<Record<string, unknown>>;

/** A string field of a provider's answer; `undefined` for any other type or an empty value. */
export function textField(body: ProviderJson, name: string): string | undefined {
  const value = body[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

async function requestJson(url: string, init: RequestInit): Promise<ProviderJson> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(OAUTH_HTTP_TIMEOUT_MS) });
    if (!response.ok) {
      Logger.warn(`Provider answered ${String(response.status)}`, LOG_CONTEXT);
      throw new OAuthFailedError();
    }
    return (await response.json()) as ProviderJson;
  } catch (error: unknown) {
    if (error instanceof OAuthFailedError) {
      throw error;
    }
    Logger.warn(`Provider could not be reached: ${error instanceof Error ? error.name : 'unknown'}`, LOG_CONTEXT);
    throw new OAuthFailedError();
  }
}

/** Trades an authorization code for an access token, by the standard form post with PKCE. */
export async function exchangeCode(
  tokenUrl: string,
  config: OAuthProviderConfig,
  grant: { readonly code: string; readonly codeVerifier: string; readonly redirectUri: string },
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: grant.code,
    code_verifier: grant.codeVerifier,
    redirect_uri: grant.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const answer = await requestJson(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });
  const token = textField(answer, 'access_token');
  if (token === undefined) {
    throw new OAuthFailedError();
  }
  return token;
}

/** The signed-in person's profile. */
export function fetchProfile(userInfoUrl: string, accessToken: string): Promise<ProviderJson> {
  return requestJson(userInfoUrl, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
}

/** The provider page a browser is sent to, with the parameters every code flow with PKCE shares. */
export function buildAuthorizeUrl(authorizeUrl: string, params: Readonly<Record<string, string>>): string {
  const url = new URL(authorizeUrl);
  for (const [name, value] of Object.entries({ response_type: 'code', code_challenge_method: 'S256', ...params })) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}
