import { describe, expect, it } from 'vitest';
import * as sharedIndex from '../src/index';
import {
  canonicalInternalRequest,
  INTERNAL_AUTH_HEADERS,
  INTERNAL_AUTH_MAX_SKEW_SECONDS,
  INTERNAL_AUTH_VERSION,
  InvalidInternalKeysError,
  parseInternalKeys,
  signInternalRequest,
  verifyInternalRequest,
  type InternalRequest,
  type InternalSigningKey,
} from '../src/internal-auth/index';

const NOW = 1_800_000_000;
const k1: InternalSigningKey = { kid: 'k1', secret: 'a'.repeat(40) };
const k2: InternalSigningKey = { kid: 'k2', secret: 'b'.repeat(40) };

const request: InternalRequest = {
  method: 'POST',
  pathWithQuery: '/store/resolve?host=a.example',
  body: '{"host":"a.example"}',
  storeId: '42',
  clientIp: '203.0.113.9',
  clientCountry: 'DZ',
};

/** What a guard reads off the incoming request: the signed headers plus the three it passes to `verify` by value. */
const signed = (r: InternalRequest = request, key = k1, at = NOW): Readonly<Record<string, string>> =>
  signInternalRequest(r, key, at);

describe('constants', () => {
  it('pins the header names, the skew and the version', () => {
    expect(INTERNAL_AUTH_HEADERS).toEqual({
      kid: 'x-internal-kid',
      timestamp: 'x-internal-ts',
      signature: 'x-internal-sig',
      storeId: 'x-store-id',
      clientIp: 'x-client-ip',
      clientCountry: 'x-client-country',
    });
    expect(INTERNAL_AUTH_MAX_SKEW_SECONDS).toBe(60);
    expect(INTERNAL_AUTH_VERSION).toBe('cod-internal-v1');
  });
});

describe('canonicalInternalRequest', () => {
  it('equals the literal D111 fixture', () => {
    expect(canonicalInternalRequest(request, NOW)).toBe(
      [
        'cod-internal-v1',
        'POST',
        '/store/resolve?host=a.example',
        '1800000000',
        '42',
        '203.0.113.9',
        'DZ',
        '3abd35f89586fbc3adffc1f97714b379517cb1ea2c9e0ab3fa83c36749245d37',
      ].join('\n'),
    );
  });

  it('upper-cases the method, leaves absent fields empty and hashes bytes like strings', () => {
    const bytes = new TextEncoder().encode('{"host":"a.example"}');

    expect(canonicalInternalRequest({ method: 'post', pathWithQuery: '/x', body: bytes }, 5)).toBe(
      [
        'cod-internal-v1',
        'POST',
        '/x',
        '5',
        '',
        '',
        '',
        '3abd35f89586fbc3adffc1f97714b379517cb1ea2c9e0ab3fa83c36749245d37',
      ].join('\n'),
    );
  });
});

describe('signInternalRequest and verifyInternalRequest', () => {
  it('verifies a signed request and names the key', () => {
    expect(verifyInternalRequest(request, signed(), [k1], NOW)).toEqual({ ok: true, kid: 'k1' });
  });

  it('sends the context headers it signed', () => {
    expect(signed()).toMatchObject({
      'x-internal-kid': 'k1',
      'x-internal-ts': String(NOW),
      'x-store-id': '42',
      'x-client-ip': '203.0.113.9',
      'x-client-country': 'DZ',
    });
  });

  it('verifies a request with no context fields and a byte body', () => {
    const bare: InternalRequest = { method: 'GET', pathWithQuery: '/store/by-id/7', body: new Uint8Array() };

    expect(verifyInternalRequest(bare, signed(bare), [k1], NOW)).toEqual({ ok: true, kid: 'k1' });
  });

  it.each<[string, Partial<InternalRequest>]>([
    ['method', { method: 'GET' }],
    ['path', { pathWithQuery: '/store/resolve/?host=a.example' }],
    ['query', { pathWithQuery: '/store/resolve?host=b.example' }],
    ['body byte', { body: '{"host":"b.example"}' }],
    ['x-store-id', { storeId: '43' }],
    ['x-client-ip', { clientIp: '203.0.113.10' }],
    ['x-client-country', { clientCountry: 'FR' }],
    ['dropped x-store-id', { storeId: undefined }],
  ])('rejects a tampered %s as bad-signature', (_name, change) => {
    expect(verifyInternalRequest({ ...request, ...change }, signed(), [k1], NOW)).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('rejects a flipped signature of the right length', () => {
    const headers = { ...signed() };
    const sig = headers['x-internal-sig'] ?? '';
    headers['x-internal-sig'] = (sig.startsWith('A') ? 'B' : 'A') + sig.slice(1);

    expect(verifyInternalRequest(request, headers, [k1], NOW)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a signature of the wrong length without throwing', () => {
    const headers = { ...signed(), 'x-internal-sig': 'short' };

    expect(verifyInternalRequest(request, headers, [k1], NOW)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it.each([-61, 61, -3600, 86_400])('rejects a timestamp %i s away as stale', (offset) => {
    expect(verifyInternalRequest(request, signed(request, k1, NOW + offset), [k1], NOW)).toEqual({
      ok: false,
      reason: 'stale',
    });
  });

  it.each([-60, 0, 60])('accepts a timestamp %i s away', (offset) => {
    expect(verifyInternalRequest(request, signed(request, k1, NOW + offset), [k1], NOW)).toEqual({
      ok: true,
      kid: 'k1',
    });
  });

  it('rejects an unknown kid', () => {
    expect(verifyInternalRequest(request, signed(), [k2], NOW)).toEqual({ ok: false, reason: 'unknown-kid' });
  });

  it.each(['x-internal-kid', 'x-internal-ts', 'x-internal-sig'])('rejects a missing %s', (name) => {
    const headers = Object.fromEntries(Object.entries(signed()).filter(([header]) => header !== name));

    expect(verifyInternalRequest(request, headers, [k1], NOW)).toEqual({ ok: false, reason: 'missing' });
    expect(verifyInternalRequest(request, { ...headers, [name]: '' }, [k1], NOW)).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it.each(['abc', '12.5', '-5', '1e9', ' 1800000000', '99999999999999999999'])(
    'rejects the timestamp %j as malformed',
    (timestamp) => {
      expect(verifyInternalRequest(request, { ...signed(), 'x-internal-ts': timestamp }, [k1], NOW)).toEqual({
        ok: false,
        reason: 'malformed',
      });
    },
  );

  it('rejects a context value with a line break as malformed, so fields cannot shift', () => {
    expect(verifyInternalRequest({ ...request, storeId: '42\nx' }, signed(), [k1], NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('verifies a request signed with k1 against [k1, k2] and not against [k2]', () => {
    expect(verifyInternalRequest(request, signed(), [k1, k2], NOW)).toEqual({ ok: true, kid: 'k1' });
    expect(verifyInternalRequest(request, signed(request, k2), [k1, k2], NOW)).toEqual({ ok: true, kid: 'k2' });
    expect(verifyInternalRequest(request, signed(), [k2], NOW)).toMatchObject({ ok: false });
  });

  it('does not accept a signature made with another key under the same kid', () => {
    const impostor: InternalSigningKey = { kid: 'k1', secret: 'c'.repeat(40) };

    expect(verifyInternalRequest(request, signed(request, impostor), [k1], NOW)).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });
});

describe('parseInternalKeys', () => {
  it('reads kid:secret pairs', () => {
    expect(parseInternalKeys(`k1:${k1.secret}, k2:${k2.secret}`)).toEqual([k1, k2]);
  });

  it.each([
    ['empty', ''],
    ['no colon', 'k1'],
    ['empty kid', `:${'a'.repeat(40)}`],
    ['bad kid characters', `K_1:${'a'.repeat(40)}`],
    ['kid over 16 characters', `${'a'.repeat(17)}:${'a'.repeat(40)}`],
    ['a trailing comma', `k1:${'a'.repeat(40)},`],
  ])('rejects %s', (_name, value) => {
    expect(() => parseInternalKeys(value)).toThrow(InvalidInternalKeysError);
  });

  it('rejects a secret under 32 characters without printing it', () => {
    const short = 'shortsecret-1234567890';
    let message = '';
    try {
      parseInternalKeys(`k1:${short}`);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidInternalKeysError);
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain(short);
  });

  it('rejects a duplicate kid without printing either secret', () => {
    const first = 'f'.repeat(40);
    const second = 'e'.repeat(40);
    let message = '';
    try {
      parseInternalKeys(`k1:${first},k1:${second}`);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidInternalKeysError);
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain(first);
    expect(message).not.toContain(second);
  });
});

describe('package boundary', () => {
  it('keeps signing out of the shared index', () => {
    expect('signInternalRequest' in sharedIndex).toBe(false);
    expect('verifyInternalRequest' in sharedIndex).toBe(false);
    expect('parseInternalKeys' in sharedIndex).toBe(false);
  });
});
