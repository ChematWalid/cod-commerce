import { describe, expect, it, vi } from 'vitest';
import { OAUTH_BINDING_COOKIE } from '../../domain/constants';
import type { BindingResponse } from '../../domain/ports/oauth-browser-binding.port';
import { OAuthBrowserBindingCookie } from '../../infrastructure/oauth-browser-binding.cookie';

const responseStub = () => ({
  cookie: vi.fn<BindingResponse['cookie']>(),
  clearCookie: vi.fn<BindingResponse['clearCookie']>(),
});

/** The name a sibling subdomain cannot plant: the browser only accepts it Secure, on Path=/ and without Domain. */
const HOST_ONLY_NAME = `__Host-${OAUTH_BINDING_COOKIE}`;

const NAME_BY_MODE: ReadonlyArray<readonly [string, boolean, string]> = [
  ['secure', true, HOST_ONLY_NAME],
  ['plain http', false, OAUTH_BINDING_COOKIE],
];

describe('the browser binding cookie', () => {
  it.each([true, false])('is HttpOnly and Lax, and Secure is %s as configured', (secure) => {
    // Arrange
    const response = responseStub();

    // Act
    new OAuthBrowserBindingCookie(secure).write(response, 'value');

    // Assert
    expect(response.cookie).toHaveBeenCalledWith(
      expect.any(String),
      'value',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure }),
    );
  });

  it.each(NAME_BY_MODE)('is written under the %s name', (_mode, secure, name) => {
    // Arrange
    const response = responseStub();

    // Act
    new OAuthBrowserBindingCookie(secure).write(response, 'value');

    // Assert
    expect(response.cookie).toHaveBeenCalledWith(name, 'value', expect.objectContaining({ path: '/', secure }));
  });

  it('carries no Domain when it is host-only, as the __Host- prefix demands', () => {
    // Arrange
    const response = responseStub();

    // Act
    new OAuthBrowserBindingCookie(true).write(response, 'value');

    // Assert
    const [name, , options] = response.cookie.mock.calls[0] ?? [];
    expect(name).toBe(HOST_ONLY_NAME);
    expect(options).not.toHaveProperty('domain');
  });

  it.each(NAME_BY_MODE)('is cleared under the %s name it was written with', (_mode, secure, name) => {
    // Arrange
    const response = responseStub();

    // Act
    new OAuthBrowserBindingCookie(secure).clear(response);

    // Assert
    expect(response.clearCookie).toHaveBeenCalledWith(name, expect.objectContaining({ path: '/', secure }));
  });

  it.each(NAME_BY_MODE)('reads its value under the %s name out of several cookies', (_mode, secure, name) => {
    // Arrange
    const cookie = `session=abc; ${name}=bound; other=1`;

    // Act
    const value = new OAuthBrowserBindingCookie(secure).read({ headers: { cookie } });

    // Assert
    expect(value).toBe('bound');
  });

  it('ignores an unprefixed cookie a sibling subdomain planted when it is secure', () => {
    // Arrange
    const cookie = `${OAUTH_BINDING_COOKIE}=planted`;

    // Act
    const value = new OAuthBrowserBindingCookie(true).read({ headers: { cookie } });

    // Assert
    expect(value).toBeUndefined();
  });

  it('reads nothing from a request without it', () => {
    // Act
    const value = new OAuthBrowserBindingCookie(true).read({ headers: {} });

    // Assert
    expect(value).toBeUndefined();
  });
});
