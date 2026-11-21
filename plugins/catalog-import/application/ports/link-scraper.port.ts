import type { HtmlProduct } from '../../domain/html-product';

/** What a scraped product page gave (D2214): plain text, an escaped description, image links and a price. */
export type ScrapedProduct = HtmlProduct;

/**
 * Reads the product page a link names (D2214). The production adapter fetches it behind the SSRF guard; the fixture
 * adapter serves synthetic pages of `shop.example.test` only.
 */
export interface LinkScraper {
  /**
   * @throws LinkRefusedError for a link the guard refuses (scheme, port, userinfo, private or unresolvable host, not
   * HTML); LinkUnreachableError when a vetted server cannot be reached in time or answers an error
   */
  scrape(url: string): Promise<ScrapedProduct>;
}
