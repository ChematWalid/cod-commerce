import { describe, expect, it } from 'vitest';
import { parsePrice, readHtmlProduct } from '../../domain/html-product';

const PAGE_URL = 'https://shop.example.com/products/kaftan';

const pageWith = (head: string, body = ''): string =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('readHtmlProduct (D2214)', () => {
  it('reads og:title, description, og:image and JSON-LD offers price', () => {
    // Arrange
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Kaftan from JSON-LD',
      offers: { '@type': 'Offer', price: '4500.00', priceCurrency: 'DZD' },
    });
    const html = pageWith(
      `<title>Shop title</title>
       <meta property="og:title" content="Synthetic kaftan">
       <meta name="description" content="A light summer kaftan.">
       <meta property="og:image" content="/img/kaftan.jpg">
       <script type="application/ld+json">${ld}</script>`,
    );

    // Act
    const product = readHtmlProduct(html, PAGE_URL);

    // Assert
    expect(product).toEqual({
      title: 'Synthetic kaftan',
      description: 'A light summer kaftan.',
      imageUrls: ['https://shop.example.com/img/kaftan.jpg'],
      price: 4500,
    });
  });

  it('falls back to the JSON-LD name and the title tag', () => {
    // Arrange
    const ld = JSON.stringify({
      '@graph': [{ '@type': ['Product'], name: 'From the graph', image: ['https://img.example.com/a.png'] }],
    });

    // Act
    const fromLd = readHtmlProduct(pageWith(`<script type="application/ld+json">${ld}</script>`), PAGE_URL);
    const fromTitle = readHtmlProduct(pageWith('<title>  Only   a title </title>'), PAGE_URL);

    // Assert
    expect(fromLd).toMatchObject({ title: 'From the graph', imageUrls: ['https://img.example.com/a.png'] });
    expect(fromTitle).toMatchObject({ title: 'Only a title', imageUrls: [] });
  });

  it("price '1 500,00 DA' → 1 500", () => {
    // Act and Assert
    expect(parsePrice('1 500,00 DA')).toBe(1500);
    expect(parsePrice('1 500,00 DA')).toBe(1500);
    expect(parsePrice('DZD 2,350.50')).toBe(2351);
    expect(parsePrice('1.234.567')).toBe(1234567);
    expect(parsePrice(4500)).toBe(4500);
    expect(parsePrice('free')).toBeUndefined();
    expect(parsePrice('-5')).toBeUndefined();
    expect(parsePrice('99999999999999')).toBeUndefined();
  });

  it('a currency word with a dot (د.ج, DA.) never reads as a decimal or grouping separator', () => {
    // Act and Assert
    expect(parsePrice('د.ج 2500')).toBe(2500);
    expect(parsePrice('1 500,00 د.ج')).toBe(1500);
    expect(parsePrice('2,500 د.ج')).toBe(2500);
    expect(parsePrice('DA. 2500')).toBe(2500);
    expect(parsePrice('1.500,00 DA.')).toBe(1500);
  });

  it('a price in another currency than DZD is unknown', () => {
    // Arrange
    const ldIn = (priceCurrency?: string): string =>
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        name: 'Priced',
        offers: { price: '25.00', ...(priceCurrency === undefined ? {} : { priceCurrency }) },
      })}</script>`;
    const metaIn = (currency: string): string =>
      `<meta property="product:price:amount" content="25.00"><meta property="product:price:currency" content="${currency}">`;

    // Act
    const inEuro = readHtmlProduct(pageWith(ldIn('EUR')), PAGE_URL);
    const inDinar = readHtmlProduct(pageWith(ldIn('dzd')), PAGE_URL);
    const unstated = readHtmlProduct(pageWith(ldIn()), PAGE_URL);
    const metaInEuro = readHtmlProduct(pageWith(metaIn('EUR')), PAGE_URL);
    const metaInDinar = readHtmlProduct(pageWith(metaIn('DZD')), PAGE_URL);

    // Assert
    expect(inEuro.price).toBeUndefined();
    expect(inDinar.price).toBe(25);
    expect(unstated.price).toBe(25);
    expect(metaInEuro.price).toBeUndefined();
    expect(metaInDinar.price).toBe(25);
  });

  it('a structured price is read as schema.org writes it: the dot is decimal, never a thousands group', () => {
    // Arrange
    const ldPriced = (price: string | number): string =>
      pageWith(
        `<script type="application/ld+json">${JSON.stringify({
          '@type': 'Product',
          name: 'Priced',
          offers: { price, priceCurrency: 'DZD' },
        })}</script>`,
      );
    const metaPriced = (amount: string): string =>
      pageWith(`<meta property="product:price:amount" content="${amount}">`);

    // Act and Assert
    expect(readHtmlProduct(ldPriced('1500.000'), PAGE_URL).price).toBe(1500);
    expect(readHtmlProduct(ldPriced('12.500'), PAGE_URL).price).toBe(13);
    expect(readHtmlProduct(ldPriced('0.990'), PAGE_URL).price).toBe(1);
    expect(readHtmlProduct(ldPriced(' 2500 '), PAGE_URL).price).toBe(2500);
    expect(readHtmlProduct(ldPriced(1500.5), PAGE_URL).price).toBe(1501);
    expect(readHtmlProduct(metaPriced('1500.000'), PAGE_URL).price).toBe(1500);
  });

  it('reads the price from product:price:amount when there is no JSON-LD', () => {
    // Act
    const product = readHtmlProduct(pageWith('<meta property="product:price:amount" content="1 500,00 DA">'), PAGE_URL);

    // Assert
    expect(product.price).toBe(1500);
  });

  it('a <script> in og:description is stored inert', () => {
    // Arrange
    const html = pageWith(
      '<meta property="og:description" content="&lt;script&gt;alert(1)&lt;/script&gt;Nice &amp; light">',
    );

    // Act
    const product = readHtmlProduct(html, PAGE_URL);

    // Assert
    expect(product.description).toBe('&lt;script&gt;alert(1)&lt;/script&gt;Nice &amp; light');
    expect(product.description).not.toContain('<');
  });

  it('a javascript: og:image is dropped', () => {
    // Arrange
    const html = pageWith(
      `<meta property="og:image" content="javascript:alert(1)">
       <meta property="og:image" content="data:image/png;base64,AAAA">
       <meta property="og:image" content="https://img.example.com/ok.jpg">`,
    );

    // Act
    const product = readHtmlProduct(html, PAGE_URL);

    // Assert
    expect(product.imageUrls).toEqual(['https://img.example.com/ok.jpg']);
  });

  it('drops control and bidi characters and a malformed JSON-LD block', () => {
    // Arrange
    const html = pageWith(
      `<meta property="og:title" content="Kaf‮tan\u0007">
       <script type="application/ld+json">{ not json</script>`,
    );

    // Act
    const product = readHtmlProduct(html, PAGE_URL);

    // Assert
    expect(product).toEqual({ title: 'Kaftan', imageUrls: [] });
  });
});
