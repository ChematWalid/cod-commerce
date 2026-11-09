import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAuthFailedError } from '../../domain/errors';
import { GoogleOAuthProvider } from '../../infrastructure/google-oauth-provider';
import { SealedOAuthStateStore } from '../../infrastructure/oauth-state-store';
import { SealedPayloadCodec, SEAL_KEY_LABEL } from '../../infrastructure/sealed-payload';

const SECRET = 'synthetic-secret-for-unit-tests-0000000';
const CONFIG = { clientId: 'synthetic-client', clientSecret: 'synthetic-secret' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a provider answering something other than a JSON object', () => {
  it.each(['null', '[1]', '"text"', '7'])('is a refusal for %s', async (body) => {
    // Arrange
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(body, { status: 200 })));
    const provider = new GoogleOAuthProvider(CONFIG);

    // Act
    const exchange = provider.exchange('code', 'verifier', 'https://api.example.test/callback');

    // Assert
    await expect(exchange).rejects.toBeInstanceOf(OAuthFailedError);
  });
});

describe('a provider confirming an email it did not send', () => {
  it('counts as unconfirmed', async () => {
    // Arrange
    const answer = { access_token: 'synthetic-access', sub: 'subject-1', email_verified: true };
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(answer), { status: 200 })));
    const provider = new GoogleOAuthProvider(CONFIG);

    // Act
    const identity = await provider.exchange('code', 'verifier', 'https://api.example.test/callback');

    // Assert
    expect(identity).toMatchObject({ email: null, emailVerified: false });
  });
});

describe('the OAuth state store', () => {
  it('does not open a value sealed for the mail queue', () => {
    // Arrange
    const mailSealed = new SealedPayloadCodec(SECRET).seal({ provider: 'google' });
    const store = new SealedOAuthStateStore(new SealedPayloadCodec(SECRET, SEAL_KEY_LABEL, 'oauth-state'));

    // Act
    const state = store.read(mailSealed);

    // Assert
    expect(state).toBeUndefined();
  });
});
