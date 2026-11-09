import { OAUTH_BINDING_COOKIE, OAUTH_BINDING_COOKIE_MAX_AGE_MS } from '../domain/constants';
import type {
  BindingRequest,
  BindingResponse,
  OAuthBrowserBindingPort,
} from '../domain/ports/oauth-browser-binding.port';

const COOKIE_PATH = '/';

/**
 * The binding as an HttpOnly cookie. `Lax` still travels on the provider's top-level redirect back, while a
 * cross-site POST or embedded request does not carry it.
 */
export class OAuthBrowserBindingCookie implements OAuthBrowserBindingPort {
  constructor(private readonly secure: boolean) {}

  read(request: BindingRequest): string | undefined {
    const pairs = (request.headers.cookie ?? '').split(';').map((pair) => pair.trim().split('='));
    const value = pairs.find(([name]) => name === OAUTH_BINDING_COOKIE)?.[1];
    return value === undefined || value === '' ? undefined : value;
  }

  write(response: BindingResponse, value: string): void {
    response.cookie(OAUTH_BINDING_COOKIE, value, { ...this.attributes(), maxAge: OAUTH_BINDING_COOKIE_MAX_AGE_MS });
  }

  clear(response: BindingResponse): void {
    response.clearCookie(OAUTH_BINDING_COOKIE, this.attributes());
  }

  private attributes(): object {
    return { httpOnly: true, sameSite: 'lax', secure: this.secure, path: COOKIE_PATH };
  }
}
