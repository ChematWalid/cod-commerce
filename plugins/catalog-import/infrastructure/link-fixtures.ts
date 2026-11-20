/** The one host the fixture scraper serves (D2214): a reserved `.test` name no real shop can have. */
export const LINK_FIXTURE_HOST = 'shop.example.test';

const ORIGIN = `https://${LINK_FIXTURE_HOST}`;

/** The links of the synthetic pages, for tests, evidence and the dashboard's e2e run. */
export const LINK_FIXTURE_URLS = {
  kaftan: `${ORIGIN}/products/kaftan`,
  noPrice: `${ORIGIN}/products/scarf`,
} as const;

const kaftanLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Synthetic summer kaftan',
  image: [`${ORIGIN}/images/kaftan-back.jpg`],
  offers: { '@type': 'Offer', price: '4500.00', priceCurrency: 'DZD' },
});

/** Synthetic product pages by path: invented products, no real shop's text or images. */
export const LINK_FIXTURE_PAGES: ReadonlyMap<string, string> = new Map([
  [
    '/products/kaftan',
    `<!doctype html><html lang="fr"><head>
      <title>Synthetic kaftan | Example test shop</title>
      <meta property="og:title" content="Synthetic summer kaftan">
      <meta property="og:description" content="A light cotton kaftan for summer evenings.">
      <meta property="og:image" content="/images/kaftan-front.jpg">
      <script type="application/ld+json">${kaftanLd}</script>
    </head><body><h1>Synthetic summer kaftan</h1></body></html>`,
  ],
  [
    '/products/scarf',
    `<!doctype html><html><head>
      <title>Synthetic silk scarf</title>
      <meta name="description" content="A synthetic scarf page that shows no price.">
    </head><body></body></html>`,
  ],
]);
