import { lookup } from 'node:dns/promises';
import type { ClientRequest } from 'node:http';
import type { LinkScraper, ScrapedProduct } from '../application/ports/link-scraper.port';
import { LINK_FETCH_TIMEOUT_MS, LINK_MAX_BYTES, LINK_MAX_REDIRECTS } from '../domain/constants';
import { LinkRefusedError, LinkUnreachableError } from '../domain/errors';
import { readHtmlProduct } from '../domain/html-product';
import {
  DEFAULT_LINK_PORTS,
  type HostResolver,
  type PortPolicy,
  resolveVettedHost,
  vetLinkTarget,
} from '../domain/ssrf';
import { type AddressSource, fetchHop, type HopPhase } from './link-hop';

export type { AddressSource } from './link-hop';

/** How the scraper reaches pages; tests inject a stub resolver and port policy (D2214). */
export interface HttpLinkScraperOptions {
  /** Default: the system resolver, every address vetted public. */
  readonly addresses?: AddressSource;
  /** Default: ports 80 and 443. */
  readonly ports?: PortPolicy;
  /** Default: {@link LINK_FETCH_TIMEOUT_MS}, DNS and every redirect hop included. */
  readonly timeoutMs?: number;
}

/** The operating system's resolver: every address of a name, in its own order. */
const systemResolver: HostResolver = {
  resolve: async (hostname) => (await lookup(hostname, { all: true, order: 'verbatim' })).map((entry) => entry.address),
};

/** Production addresses: resolved by the system, refused unless every one is public (D2214). */
export const VETTED_DNS_ADDRESSES: AddressSource = {
  addressesOf: (hostname) => resolveVettedHost(hostname, systemResolver),
};

/** One scrape: its current request (to destroy on timeout), whether it is waiting on DNS, and whether it timed out. */
class LinkFetch {
  private current: ClientRequest | undefined;
  private phase: HopPhase = 'resolving';
  /** Set by a timeout: no further hop starts, even one whose redirect arrived just before. */
  private aborted = false;

  constructor(
    private readonly addresses: AddressSource,
    private readonly ports: PortPolicy,
  ) {}

  /** The page `link` leads to after at most {@link LINK_MAX_REDIRECTS} redirects, each target vetted again. */
  async page(link: string): Promise<{ html: string; url: string }> {
    let target = link;
    for (let redirects = 0; ; redirects += 1) {
      const vetted = vetLinkTarget(target, this.ports);
      if (!vetted.ok || this.aborted) throw new LinkRefusedError();
      const answer = await fetchHop(vetted, {
        addresses: this.addresses,
        maxBytes: LINK_MAX_BYTES,
        track: (request) => (this.current = request),
        phase: (phase) => (this.phase = phase),
      });
      if (answer.kind === 'page') return { html: answer.html, url: vetted.url.href };
      if (redirects >= LINK_MAX_REDIRECTS || !URL.canParse(answer.location, vetted.url.href))
        throw new LinkRefusedError();
      target = new URL(answer.location, vetted.url).href;
    }
  }

  /** Stops the fetch: a timeout in DNS is a refusal like any DNS failure; after a vetted connect, unreachable. */
  abort(): Error {
    this.aborted = true;
    this.current?.destroy();
    return this.phase === 'resolving' ? new LinkRefusedError() : new LinkUnreachableError();
  }
}

/**
 * {@link LinkScraper} over `node:http`/`node:https` behind the SSRF guard (D2214): every link and redirect target is
 * vetted (scheme, port, userinfo, host), every connection's lookup vets each resolved address, no proxy is used
 * whatever `HTTP(S)_PROXY` says, at most 3 redirects, 2 MiB and 5 s in all; only `text/html` is read. Resolved
 * addresses and library errors never reach the answer.
 */
export class HttpLinkScraper implements LinkScraper {
  private readonly addresses: AddressSource;
  private readonly ports: PortPolicy;
  private readonly timeoutMs: number;

  constructor(options: HttpLinkScraperOptions = {}) {
    this.addresses = options.addresses ?? VETTED_DNS_ADDRESSES;
    this.ports = options.ports ?? DEFAULT_LINK_PORTS;
    this.timeoutMs = options.timeoutMs ?? LINK_FETCH_TIMEOUT_MS;
  }

  async scrape(link: string): Promise<ScrapedProduct> {
    const fetch = new LinkFetch(this.addresses, this.ports);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(fetch.abort());
      }, this.timeoutMs);
    });
    try {
      const page = await Promise.race([fetch.page(link), timeout]);
      return readHtmlProduct(page.html, page.url);
    } finally {
      clearTimeout(timer);
    }
  }
}
