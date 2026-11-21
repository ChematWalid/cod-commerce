import { describe, expect, it } from 'vitest';
import { LinkRefusedError, LinkUnreachableError } from '../../domain/errors';
import { FixtureLinkScraper } from '../../infrastructure/fixture-link-scraper';
import { LINK_FIXTURE_HOST, LINK_FIXTURE_URLS } from '../../infrastructure/link-fixtures';

describe('FixtureLinkScraper (D2214)', () => {
  const scraper = new FixtureLinkScraper();

  it('reads a synthetic page of shop.example.test', async () => {
    // Act
    const product = await scraper.scrape(LINK_FIXTURE_URLS.kaftan);

    // Assert
    expect(product.title).toBeTruthy();
    expect(product.price).toBeGreaterThan(0);
    expect(product.imageUrls.length).toBeGreaterThan(0);
  });

  it('the fixture scraper refuses any host other than shop.example.test', async () => {
    // Arrange
    const others = [
      'https://example.com/products/kaftan',
      'https://shop.example.test.evil.example/products/kaftan',
      'http://127.0.0.1/products/kaftan',
      'https://SHOP.EXAMPLE.TEST.attacker.example/',
    ];

    // Act and Assert
    expect(LINK_FIXTURE_HOST).toBe('shop.example.test');
    for (const url of others) await expect(scraper.scrape(url)).rejects.toBeInstanceOf(LinkRefusedError);
  });

  it('answers link-unreachable for a path it has no page for, without any network fallback', async () => {
    // Act and Assert
    await expect(scraper.scrape('https://shop.example.test/no-such-page')).rejects.toBeInstanceOf(LinkUnreachableError);
  });
});
