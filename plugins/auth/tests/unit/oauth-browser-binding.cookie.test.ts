import { describe, expect, it, vi } from 'vitest';
import { OAUTH_BINDING_COOKIE } from '../../domain/constants';
import { OAuthBrowserBindingCookie } from '../../infrastructure/oauth-browser-binding.cookie';

const responseStub = () => ({ cookie: vi.fn(), clearCookie: vi.fn() });

describe('the browser binding cookie', () => {
  it.each([true, false])('is HttpOnly and Lax, and Secure is %s as configured', (secure) => {
    // Arrange
    const response = responseStub();

    // Act
    new OAuthBrowserBindingCookie(secure).write(response, 'value');

    // Assert
    expect(response.cookie).toHaveBeenCalledWith(
      OAUTH_BINDING_COOKIE,
      'value',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure }),
    );
  });

  it('reads its value out of several cookies', () => {
    // Arrange
    const cookie = `session=abc; ${OAUTH_BINDING_COOKIE}=bound; other=1`;

    // Act
    const value = new OAuthBrowserBindingCookie(true).read({ headers: { cookie } });

    // Assert
    expect(value).toBe('bound');
  });

  it('reads nothing from a request without it', () => {
    // Act
    const value = new OAuthBrowserBindingCookie(true).read({ headers: {} });

    // Assert
    expect(value).toBeUndefined();
  });
});
