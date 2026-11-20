import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LINK_FETCH_TIMEOUT_MS, LINK_MAX_BYTES } from '../../domain/constants';
import { LinkRefusedError, LinkUnreachableError } from '../../domain/errors';
import { type AddressSource, HttpLinkScraper } from '../../infrastructure/http-link-scraper';
import { HOST, html, LOOPBACK, page, redirect, StubServer } from '../support/stub-http-server';

/** A scrape's failure, caught at once so a rejection never waits unhandled while another call runs. */
const failureOf = (scrape: Promise<unknown>): Promise<unknown> =>
  scrape.then(
    () => undefined,
    (error: unknown) => error,
  );

const allowAll = (): AddressSource & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    addressesOf: (hostname) => {
      calls.push(hostname);
      return Promise.resolve([LOOPBACK]);
    },
  };
};

describe('HttpLinkScraper (D2214)', () => {
  const stub = new StubServer();
  const portOfStub = { allows: (port: number): boolean => port === stub.port };
  const scraperWith = (addresses: AddressSource, timeoutMs?: number): HttpLinkScraper =>
    new HttpLinkScraper({ addresses, ports: portOfStub, ...(timeoutMs === undefined ? {} : { timeoutMs }) });

  beforeAll(async () => {
    await stub.start();
  });

  afterEach(() => {
    stub.routes = new Map();
    stub.seen.length = 0;
  });

  afterAll(async () => {
    await stub.stop();
  });

  it('reads the page a public host serves', async () => {
    // Arrange
    stub.routes.set('/p', html(page('Synthetic kaftan')));

    // Act
    const product = await scraperWith(allowAll()).scrape(stub.url('/p'));

    // Assert
    expect(product.title).toBe('Synthetic kaftan');
  });

  it('the lookup runs on every connection, including each redirect hop', async () => {
    // Arrange: the name resolves to a public address first, then rebinds to a private one
    stub.routes.set('/a', redirect('/b'));
    stub.routes.set('/b', html(page('Behind the rebinding')));
    const calls: string[] = [];
    const rebinding: AddressSource = {
      addressesOf: (hostname) => {
        calls.push(hostname);
        return calls.length === 1 ? Promise.resolve([LOOPBACK]) : Promise.reject(new LinkRefusedError());
      },
    };
    const counting = allowAll();
    stub.routes.set('/c', redirect('/d'));
    stub.routes.set('/d', html(page('Two hops')));

    // Act
    const refused = failureOf(scraperWith(rebinding).scrape(stub.url('/a')));
    const twoHops = await scraperWith(counting).scrape(stub.url('/c'));

    // Assert
    expect(await refused).toBeInstanceOf(LinkRefusedError);
    expect(calls).toEqual([HOST, HOST]);
    expect(stub.seen.map((request) => request.url)).not.toContain('/b');
    expect(twoHops.title).toBe('Two hops');
    expect(counting.calls).toEqual([HOST, HOST]);
  });

  it('re-checks scheme, port and userinfo of every redirect target, relative ones too', async () => {
    // Arrange
    const targets = [
      `ftp://${HOST}/file`,
      'file:///etc/passwd',
      stub.url('/ok').replace('://', '://user@'),
      `//user:secret@${HOST}:${String(stub.port)}/ok`,
      `http://${HOST}:8080/ok`,
      `//${HOST}:8080/ok`,
      `http://${LOOPBACK}:${String(stub.port)}/ok`,
      `http://localhost:${String(stub.port)}/ok`,
    ];
    stub.routes.set('/ok', html(page('Reached')));
    stub.routes.set('/relative', redirect('ok'));

    // Act and Assert
    for (const [index, target] of targets.entries()) {
      stub.routes.set(`/r${String(index)}`, redirect(target));
      await expect(scraperWith(allowAll()).scrape(stub.url(`/r${String(index)}`))).rejects.toBeInstanceOf(
        LinkRefusedError,
      );
    }
    expect(stub.seen.map((request) => request.url)).not.toContain('/ok');
    expect((await scraperWith(allowAll()).scrape(stub.url('/relative'))).title).toBe('Reached');
  });

  it('stops after 3 redirects', async () => {
    // Arrange
    for (const hop of [1, 2, 3, 4]) stub.routes.set(`/h${String(hop)}`, redirect(`/h${String(hop + 1)}`));
    stub.routes.set('/h5', html(page('Five')));
    stub.routes.set('/h4', redirect('/end'));
    stub.routes.set('/end', html(page('After three')));

    // Act
    const threeRedirects = await scraperWith(allowAll()).scrape(stub.url('/h2'));
    const fourRedirects = await failureOf(scraperWith(allowAll()).scrape(stub.url('/h1')));

    // Assert
    expect(threeRedirects.title).toBe('After three');
    expect(fourRedirects).toBeInstanceOf(LinkRefusedError);
  });

  it('stops at 2 MiB of received bytes and sends accept-encoding identity', async () => {
    // Arrange
    let finished = true;
    const chunk = Buffer.alloc(64 * 1024, 'x');
    stub.routes.set('/big', (_request, response) => {
      finished = false;
      response.writeHead(200, { 'content-type': 'text/html' });
      response.write(`<html><head><meta property="og:title" content="Heavy page"></head><body>`);
      let sent = 0;
      const pump = (): void => {
        while (sent < 4 * LINK_MAX_BYTES && !response.destroyed) {
          sent += chunk.length;
          if (!response.write(chunk)) {
            response.once('drain', pump);
            return;
          }
        }
        if (!response.destroyed) response.end('</body></html>', () => (finished = true));
      };
      pump();
    });

    // Act
    const product = await scraperWith(allowAll()).scrape(stub.url('/big'));

    // Assert
    expect(product.title).toBe('Heavy page');
    expect(stub.seen[0]?.headers['accept-encoding']).toBe('identity');
    expect(finished).toBe(false);
  });

  it('ignores HTTP_PROXY and HTTPS_PROXY', async () => {
    // Arrange
    const proxy = new StubServer();
    await proxy.start();
    proxy.routes.set(stub.url('/direct'), html(page('Through the proxy')));
    stub.routes.set('/direct', html(page('Direct')));
    const saved = { http: process.env['HTTP_PROXY'], https: process.env['HTTPS_PROXY'], no: process.env['NO_PROXY'] };
    process.env['HTTP_PROXY'] = `http://${LOOPBACK}:${String(proxy.port)}`;
    process.env['HTTPS_PROXY'] = `http://${LOOPBACK}:${String(proxy.port)}`;
    delete process.env['NO_PROXY'];

    try {
      // Act
      const product = await scraperWith(allowAll()).scrape(stub.url('/direct'));

      // Assert
      expect(product.title).toBe('Direct');
      expect(proxy.seen).toEqual([]);
    } finally {
      for (const [name, value] of [
        ['HTTP_PROXY', saved.http],
        ['HTTPS_PROXY', saved.https],
        ['NO_PROXY', saved.no],
      ] as const) {
        if (value === undefined) Reflect.deleteProperty(process.env, name);
        else process.env[name] = value;
      }
      await proxy.stop();
    }
  });

  it('refuses non-HTML', async () => {
    // Arrange
    stub.routes.set('/json', (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' }).end('{"title":"no"}');
    });
    stub.routes.set('/untyped', (_request, response) => {
      response.writeHead(200).end(page('No type'));
    });

    // Act and Assert
    await expect(scraperWith(allowAll()).scrape(stub.url('/json'))).rejects.toBeInstanceOf(LinkRefusedError);
    await expect(scraperWith(allowAll()).scrape(stub.url('/untyped'))).rejects.toBeInstanceOf(LinkRefusedError);
  });

  it('answers link-unreachable for a status other than 2xx', async () => {
    // Arrange
    stub.routes.set('/gone', (_request, response) => {
      response.writeHead(500, { 'content-type': 'text/html' }).end(page('Error'));
    });

    // Act and Assert
    await expect(scraperWith(allowAll()).scrape(stub.url('/gone'))).rejects.toBeInstanceOf(LinkUnreachableError);
  });

  it('times out at 5 s including DNS', async () => {
    // Arrange
    const hanging: AddressSource = { addressesOf: () => new Promise<readonly string[]>(() => undefined) };
    stub.routes.set('/slow', () => undefined);
    const started = Date.now();

    // Act
    const [inDns, inResponse] = await Promise.all([
      failureOf(scraperWith(hanging, 100).scrape(stub.url('/p'))),
      failureOf(scraperWith(allowAll(), 100).scrape(stub.url('/slow'))),
    ]);

    // Assert
    expect(LINK_FETCH_TIMEOUT_MS).toBe(5_000);
    expect(inDns).toBeInstanceOf(LinkRefusedError);
    expect(inResponse).toBeInstanceOf(LinkUnreachableError);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('never echoes the resolved IP or the library error', async () => {
    // Arrange: a port nothing listens on any more
    const closed = new StubServer();
    await closed.start();
    const { port } = closed;
    await closed.stop();
    const scraper = new HttpLinkScraper({ addresses: allowAll(), ports: { allows: () => true } });

    // Act
    const failure = await failureOf(scraper.scrape(`http://${HOST}:${String(port)}/p`));

    // Assert
    expect(failure).toBeInstanceOf(LinkUnreachableError);
    const text = `${(failure as Error).message} ${JSON.stringify(failure)} ${String((failure as Error).stack)}`;
    expect(text).not.toContain(LOOPBACK);
    expect(text).not.toMatch(/ECONNREFUSED|connect /);
    expect((failure as Error).cause).toBeUndefined();
  });
});
