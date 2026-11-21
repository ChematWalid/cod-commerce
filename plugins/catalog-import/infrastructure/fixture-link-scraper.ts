import type { LinkScraper, ScrapedProduct } from '../application/ports/link-scraper.port';
import { LinkRefusedError, LinkUnreachableError } from '../domain/errors';
import { readHtmlProduct } from '../domain/html-product';
import { LINK_FIXTURE_HOST, LINK_FIXTURE_PAGES } from './link-fixtures';

const SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * The scraper of the integration, e2e and evidence runs (`LINK_IMPORT_SCRAPER=fixture`, refused in production, D2214):
 * synthetic pages of `shop.example.test` only. Any other host is refused and nothing ever reaches the network.
 */
export class FixtureLinkScraper implements LinkScraper {
  scrape(link: string): Promise<ScrapedProduct> {
    if (!URL.canParse(link)) return Promise.reject(new LinkRefusedError());
    const url = new URL(link);
    const isFixtureHost =
      SCHEMES.has(url.protocol) && url.hostname === LINK_FIXTURE_HOST && url.username === '' && url.port === '';
    if (!isFixtureHost) return Promise.reject(new LinkRefusedError());
    const page = LINK_FIXTURE_PAGES.get(url.pathname);
    if (page === undefined) return Promise.reject(new LinkUnreachableError());
    return Promise.resolve(readHtmlProduct(page, url.href));
  }
}
