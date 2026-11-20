import { CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { LinkRefusedError } from '../../domain/errors';
import {
  DEFAULT_LINK_PORTS,
  type HostResolver,
  isPublicAddress,
  resolveVettedHost,
  vetLinkTarget,
} from '../../domain/ssrf';

/** A host as a URL spells it: an IPv6 literal goes in brackets, everything else as is. */
const urlOf = (host: string): string =>
  host.includes(':') && !host.startsWith('[') ? `http://[${host}]/` : `http://${host}/`;

const resolverOf = (answer: () => Promise<readonly string[]>): HostResolver => ({ resolve: answer });

const REFUSED_ADDRESSES = [
  '127.0.0.1',
  '10.0.0.1',
  '172.16.0.1',
  '192.168.1.1',
  '169.254.169.254',
  '100.64.0.1',
  '0.0.0.0',
  '224.0.0.1',
  '240.0.0.1',
  '198.18.0.1',
  '192.0.0.1',
  '::',
  '::1',
  'fc00::1',
  'fe80::1',
  '::ffff:127.0.0.1',
  '[::ffff:7f00:1]',
  '::127.0.0.1',
  '2002:7f00:1::',
  '2001::1',
  '64:ff9b::7f00:1',
  '64:ff9b:1::1',
  '100::1',
  '2001:db8::1',
];

const REFUSED_HOSTS = ['2130706433', '0x7f000001', '0177.0.0.1', '127.1', '0', 'localhost.', 'LOCALHOST', 'localhost'];

describe('vetLinkTarget (D2214)', () => {
  it.each(REFUSED_ADDRESSES)('refuses %s', (address) => {
    // Act
    const verdict = vetLinkTarget(urlOf(address));

    // Assert
    expect(verdict).toEqual({ ok: false });
  });

  it.each(REFUSED_ADDRESSES.filter((address) => !address.startsWith('[')))('classifies %s as not public', (address) => {
    // Act and Assert
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(REFUSED_HOSTS)('refuses the host %s', (host) => {
    // Act
    const verdict = vetLinkTarget(`http://${host}/`);

    // Assert
    expect(verdict).toEqual({ ok: false });
  });

  it('refuses a zone id: fe80::1%25eth0 in a URL and fe80::1%eth0 as an address', () => {
    // Act and Assert
    expect(vetLinkTarget('http://[fe80::1%25eth0]/')).toEqual({ ok: false });
    expect(isPublicAddress('fe80::1%eth0')).toBe(false);
    expect(isPublicAddress('2606:4700::1%eth0')).toBe(false);
  });

  it('refuses port 8080, the ftp: and file: schemes and userinfo', () => {
    // Act and Assert
    expect(vetLinkTarget('http://93.184.216.34:8080/')).toEqual({ ok: false });
    expect(vetLinkTarget('ftp://93.184.216.34/')).toEqual({ ok: false });
    expect(vetLinkTarget('file:///etc/passwd')).toEqual({ ok: false });
    expect(vetLinkTarget('http://user@shop.example.com/')).toEqual({ ok: false });
    expect(vetLinkTarget('http://user:secret@shop.example.com/')).toEqual({ ok: false });
  });

  it('refuses internal host names: one label, .local, .internal and .localhost', () => {
    // Act and Assert
    for (const host of ['garage', 'postgres', 'printer.local', 'metadata.google.internal', 'app.localhost']) {
      expect(vetLinkTarget(`http://${host}/`)).toEqual({ ok: false });
    }
  });

  it('accepts 93.184.216.34:443', () => {
    // Act
    const verdict = vetLinkTarget('https://93.184.216.34:443/product');

    // Assert
    expect(verdict).toMatchObject({ ok: true, hostname: '93.184.216.34', port: 443, isIpLiteral: true });
  });

  it('accepts a public name on the default ports and keeps it to resolve', () => {
    // Act and Assert
    expect(vetLinkTarget('https://shop.example.com/p/1')).toMatchObject({
      ok: true,
      hostname: 'shop.example.com',
      port: 443,
      isIpLiteral: false,
    });
    expect(vetLinkTarget('http://shop.example.com/p/1')).toMatchObject({ ok: true, port: 80 });
  });

  it('accepts a public IPv6 literal and a 6to4 address wrapping a public IPv4', () => {
    // Act and Assert
    expect(vetLinkTarget('http://[2606:4700::1111]/')).toMatchObject({ ok: true, isIpLiteral: true });
    expect(isPublicAddress('2002:5db8:d822::1')).toBe(true);
  });

  it('takes another port only from an injected port policy', () => {
    // Arrange
    const anyPort = { allows: (): boolean => true };

    // Act and Assert
    expect(vetLinkTarget('http://shop.example.com:43123/', anyPort)).toMatchObject({ ok: true, port: 43123 });
    expect(vetLinkTarget('http://shop.example.com:43123/', DEFAULT_LINK_PORTS)).toEqual({ ok: false });
  });
});

describe('resolveVettedHost (D2214)', () => {
  it('answers the addresses of a host that resolves to public addresses only', async () => {
    // Arrange
    const resolver = resolverOf(() => Promise.resolve(['93.184.216.34', '2606:2800:220:1::1']));

    // Act
    const addresses = await resolveVettedHost('shop.example.com', resolver);

    // Assert
    expect(addresses).toEqual(['93.184.216.34', '2606:2800:220:1::1']);
  });

  it('refuses when any resolved address is private', async () => {
    // Arrange
    const resolver = resolverOf(() => Promise.resolve(['93.184.216.34', '10.0.0.7']));

    // Act and Assert
    await expect(resolveVettedHost('shop.example.com', resolver)).rejects.toBeInstanceOf(LinkRefusedError);
  });

  it('NXDOMAIN, DNS failure and a private address give the same link-refused', async () => {
    // Arrange
    const nxdomain = Object.assign(new Error('getaddrinfo ENOTFOUND intranet.example.com'), { code: 'ENOTFOUND' });
    const failing = Object.assign(new Error('queryA ESERVFAIL 10.0.0.53'), { code: 'ESERVFAIL' });
    const resolvers = [
      resolverOf(() => Promise.reject(nxdomain)),
      resolverOf(() => Promise.reject(failing)),
      resolverOf(() => Promise.resolve(['192.168.0.10'])),
      resolverOf(() => Promise.resolve([])),
    ];

    // Act
    const failures = await Promise.all(
      resolvers.map((resolver) =>
        resolveVettedHost('intranet.example.com', resolver).then(
          () => undefined,
          (error: unknown) => error,
        ),
      ),
    );

    // Assert
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(LinkRefusedError);
      expect(failure).toMatchObject({ code: CATALOG_IMPORT_ERROR_CODES.LINK_REFUSED, message: 'Link refused' });
    }
  });
});
