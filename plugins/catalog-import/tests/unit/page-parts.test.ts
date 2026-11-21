import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { LINK_MAX_BYTES } from '../../domain/constants';
import { readHtmlProduct } from '../../domain/html-product';
import { readPageParts } from '../../domain/page-parts';

const PAGE_URL = 'https://shop.example.com/products/kaftan';
const META_KEYS: ReadonlySet<string> = new Set(['og:title', 'og:image', 'description']);
/** Generous for a slow CI runner; the DOM parser this replaced took seconds at 40 KB and hours at 2 MiB. */
const HOSTILE_PAGE_BUDGET_MS = 2_000;

const fill = (unit: string, bytes = LINK_MAX_BYTES): string => unit.repeat(Math.floor(bytes / unit.length));

const elapsedMs = (run: () => unknown): number => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

describe('readPageParts (D2275)', () => {
  it('reads metas, the first title and JSON-LD blocks, decoding entities', () => {
    // Arrange
    const html = `<!doctype html><HTML><head>
      <title>Kaftan &amp; co</title><title>second</title>
      <META Property="OG:Title" content='Caftan &eacute;t&eacute;'>
      <meta name=description content=light/>
      <meta property="og:image" content="/a.jpg" property="ignored">
      <meta property="unrelated" content="x">
      <SCRIPT type=" application/ld+json ">{"@type":"Product"}</SCRIPT>
      <script>var s = "<meta property='og:image' content='/b.jpg'>";</script>
      <!-- <meta property="og:image" content="/c.jpg"> -->
      </head><body>1 < 2 <meta property="og:image" content="/d.jpg"></body></HTML>`;

    // Act
    const parts = readPageParts(html, META_KEYS);

    // Assert
    expect(parts).toEqual({
      title: 'Kaftan & co',
      metas: [
        { key: 'og:title', content: 'Caftan été' },
        { key: 'description', content: 'light/' },
        { key: 'og:image', content: '/a.jpg' },
        { key: 'og:image', content: '/d.jpg' },
      ],
      ldBlocks: ['{"@type":"Product"}'],
    });
  });

  it('an unclosed quote, comment or script ends the page instead of failing', () => {
    // Act
    const unclosedQuote = readPageParts('<meta property="og:title" content="Kaftan', META_KEYS);
    const unclosedComment = readPageParts('<title>T</title><!-- <meta property="og:title" content="x">', META_KEYS);
    const unclosedScript = readPageParts('<script type="application/ld+json">{"a":1}', META_KEYS);

    // Assert
    expect(unclosedQuote.metas).toEqual([{ key: 'og:title', content: 'Kaftan' }]);
    expect(unclosedComment).toEqual({ title: 'T', metas: [], ldBlocks: [] });
    expect(unclosedScript.ldBlocks).toEqual(['{"a":1}']);
  });

  it.each([
    ['2 MiB of unclosed nested <div>', fill('<div>')],
    ['2 MiB of og:image metas', fill('<meta property="og:image" content="/a">')],
    [
      '2 MiB of open tags then unmatched close tags',
      fill('<b>', LINK_MAX_BYTES / 2) + fill('</i>', LINK_MAX_BYTES / 2),
    ],
    ['2 MiB of unclosed quotes', fill('<meta content="')],
    ['2 MiB of empty JSON-LD blocks', fill('<script type="application/ld+json">[]</script>')],
    ['2 MiB of attributes in one tag', `<meta ${fill('a=b ')}>`],
  ])('reads %s within the time budget', (_name, html) => {
    // Act
    const ms = elapsedMs(() => readHtmlProduct(html, PAGE_URL));

    // Assert
    expect(ms).toBeLessThan(HOSTILE_PAGE_BUDGET_MS);
  });
});
