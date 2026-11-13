import { HOST_ONLY_COOKIE_PREFIX, OAUTH_BINDING_COOKIE, OAUTH_BINDING_COOKIE_MAX_AGE_MS } from '../domain/constants';
import type {
  BindingRequest,
  BindingResponse,
  OAuthBrowserBindingPort,
} from '../domain/ports/oauth-browser-binding.port';

const COOKIE_PATH = '/';

/**
 * The binding as an HttpOnly cookie. `Lax` still travels on the provider's top-level redirect back, while a
 * cross-site POST or embedded request does not carry it. When Secure it is named `__Host-…`, so a sibling
 * subdomain cannot plant it; read, write and clear all use that one name.
 */
export class OAuthBrowserBindingCookie implements OAuthBrowserBindingPort {
  private readonly name: string;

  constructor(private readonly secure: boolean) {
    this.name = secure ? `${HOST_ONLY_COOKIE_PREFIX}${OAUTH_BINDING_COOKIE}` : OAUTH_BINDING_COOKIE;
  }

  read(request: BindingRequest): string | undefined {
    const pairs = (request.headers.cookie ?? '').split(';').map((pair) => pair.trim().split('='));
    const value = pairs.find(([name]) => name === this.name)?.[1];
    return value === undefined || value === '' ? undefined : value;
  }

  write(response: BindingResponse, value: string): void {
    response.cookie(this.name, value, { ...this.attributes(), maxAge: OAUTH_BINDING_COOKIE_MAX_AGE_MS });
  }

  clear(response: BindingResponse): void {
    response.clearCookie(this.name, this.attributes());
  }

  private attributes(): object {
    return { httpOnly: true, sameSite: 'lax', secure: this.secure, path: COOKIE_PATH };
  }
}
