// Browser part of scripts/evidence/P3.S2.sh: the storefront pages of the Arabic (RTL), French and English stores on desktop
// 1280x800 and mobile 390x844 (mode `stores`), or the compact-theme home of the Arabic and English stores (mode `compact`).
//
//   node P3.S2-screens.mjs <storefront-port> <out-dir> <stores|compact>
//
// Env: EV_STORES_JSON, the stores the API part read from the api (host, name, locale, a product with options and its
// second option, a collection, a search term, the listed names). Chromium resolves *.localhost to the loopback address, so
// the store is chosen by the Host header the browser sends, as in production. Every failed check throws; each check that
// passed is written to stderr once per kind (the README lists them), each PNG to stdout as `shot <file> <bytes>`.
/* global process, console, URL, document, window, requestAnimationFrame */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/storefront/package.json'))('playwright-core');

const [port, outDir, mode] = process.argv.slice(2);
if (!port || !outDir || !['stores', 'compact'].includes(mode ?? '')) throw new Error('usage: see the header of this file');

const MAX_BYTES = 300 * 1024;
const STEP_TIMEOUT_MS = 30_000;
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
/** The reference product's name (ADR 0007) and the frameworks' names: none may show on a buyer's screen. */
const BANNED_NAMES = /tassyir|tassya|vendure|next\.js/i;
/** A catalogue key shown as text means a missing translation. */
const RAW_MESSAGE_KEY =
  /\b(announcement|hero|nav|search|products|pagination|product|collections?|cart|checkout|success|trust|footer|notFound|money)\.[a-z][A-Za-z]+\b/;
/** A snowflake id shown as text means a raw id leaked into the page. */
const RAW_ID = /\b[1-9][0-9]{15,18}\b/;
const MISSING_PATH = '/this-page-does-not-exist';
/** `COMPACT_THEME.pages.home` in packages/shared/src/storefront/theme/compact-theme.ts. */
const COMPACT_HOME_SECTIONS = ['header', 'product-grid', 'footer'];

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}
const env = (name) => process.env[name] ?? fail(`${name} must be set`);
const stores = JSON.parse(readFileSync(env('EV_STORES_JSON'), 'utf8'));
const catalogue = (locale) => JSON.parse(readFileSync(join(root, `packages/shared/src/storefront/i18n/${locale}.json`), 'utf8'));
const passed = new Set();
const note = (line) => {
  if (!passed.has(line)) {
    passed.add(line);
    console.error(line);
  }
};

/** Every other store's name as a pattern that does not match inside a longer name ("Demo Store" in "Demo Store 2"). */
function otherNamesPattern(store) {
  const names = stores.filter((s) => s.key !== store.key).map((s) => s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${names.join('|')})(?![\\w ]*\\d)`);
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
    note('a page kept a request open past 10 s; the shot was taken anyway');
  });
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((img) => (img.complete ? null : new Promise((resolve) => img.addEventListener('load', resolve, { once: true })))),
    ),
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** The checks every page gets: direction, no other store, no raw key or id, no banned name, no sideways scroll, images loaded. */
async function commonChecks(page, store, label) {
  const facts = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    text: document.body.innerText,
    title: document.title,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    broken: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src),
  }));
  if (facts.dir !== store.dir || facts.lang !== store.locale)
    fail(`${label}: <html> is lang=${facts.lang} dir=${facts.dir}, expected ${store.locale} ${store.dir}`);
  if (otherNamesPattern(store).test(facts.text)) fail(`${label}: another store's name is on the page`);
  const key = RAW_MESSAGE_KEY.exec(facts.text);
  if (key) fail(`${label}: raw message key '${key[0]}' on the page`);
  if (RAW_ID.test(facts.text)) fail(`${label}: a raw id is on the page`);
  if (BANNED_NAMES.test(facts.text) || BANNED_NAMES.test(facts.title)) fail(`${label}: a third-party name is on the page`);
  if (facts.overflow > 1) fail(`${label}: the page scrolls sideways by ${facts.overflow}px`);
  if (facts.broken.length > 0) fail(`${label}: images failed to load: ${facts.broken.join(', ')}`);
  note(
    'every page: <html> lang/dir of the store (ar rtl, fr and en ltr), no other store\'s name, no raw message key or snowflake id, no third-party product or framework name, no sideways scroll, every image loaded',
  );
}

async function open(page, store, path, label, statuses = [200]) {
  const url = `http://${store.host}:${port}${path}`;
  const response = await page.goto(url, { waitUntil: 'load', timeout: STEP_TIMEOUT_MS });
  if (!statuses.includes(response?.status() ?? 0)) fail(`${label}: ${url} answered ${response?.status()}`);
  await settle(page);
  return response.status();
}

async function shoot(page, file) {
  const path = join(outDir, `${file}.png`);
  await page.screenshot({ path });
  const size = statSync(path).size;
  if (size > MAX_BYTES) fail(`${path} is ${size} bytes, over ${MAX_BYTES}`);
  console.log(`shot ${file}.png ${size}`);
}

const visibleText = (page, selector) => page.locator(selector).first().innerText({ timeout: STEP_TIMEOUT_MS });

/** The nine pages of one store in one viewport, in a buyer's order (the cart holds what the product page added). */
async function storePages(browser, store, vp) {
  const t = catalogue(store.locale);
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  const name = (p) => `${store.key}-${p}-${vp}`;
  try {
    await open(page, store, '/', name('home'));
    const shown = (await visibleText(page, '[data-testid="store-name"]')).trim();
    if (shown !== store.name) fail(`${name('home')}: store name '${shown}', expected '${store.name}'`);
    await commonChecks(page, store, name('home'));
    note('home: the store name in the header is the store\'s own');
    await shoot(page, name('home'));

    await open(page, store, '/products', name('products'));
    const listing = await page.evaluate(() => document.body.innerText);
    if (!store.productNames.some((n) => listing.includes(n))) fail(`${name('products')}: none of the store's products shown`);
    if (!listing.includes(t['products.title'])) fail(`${name('products')}: no '${t['products.title']}' heading`);
    await commonChecks(page, store, name('products'));
    note('products: the localized "All products" heading and the store\'s own products');
    await shoot(page, name('products'));

    await open(page, store, `/product/${encodeURIComponent(store.productSlug)}`, name('product'));
    const h1 = (await visibleText(page, '.product-info h1')).trim();
    if (h1 !== store.productName) fail(`${name('product')}: h1 '${h1}', expected '${store.productName}'`);
    const option = page.locator('.option-group').first().getByRole('button', { name: store.secondOption, exact: true });
    await option.click({ timeout: STEP_TIMEOUT_MS });
    if ((await option.getAttribute('aria-pressed')) !== 'true') fail(`${name('product')}: '${store.secondOption}' is not pressed`);
    const price = (await visibleText(page, '[data-testid="variant-price"]')).trim();
    if (!/\d/.test(price)) fail(`${name('product')}: the price '${price}' has no amount`);
    // The click leaves the picker in view; the shot starts at the product's name so name, image, price and options show.
    await page.locator('.product-info h1').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await settle(page);
    await commonChecks(page, store, name('product'));
    note('product: h1 is the product\'s name; the second option of the first group is pressed after a click and a price shows');
    await shoot(page, name('product'));
    await page.getByRole('button', { name: t['product.addToCart'], exact: true }).click({ timeout: STEP_TIMEOUT_MS });
    const stored = await page.evaluate(() => window.localStorage.getItem('cod.cart.v1'));
    if (!stored || !stored.includes('variantId')) fail(`${name('product')}: add to cart stored nothing`);
    note('product: "add to cart" stores a line (variant id and quantity) in localStorage cod.cart.v1');

    await open(page, store, `/category/${encodeURIComponent(store.categorySlug)}`, name('category'));
    const category = await page.evaluate(() => document.body.innerText);
    if (!category.includes(store.categoryTitle)) fail(`${name('category')}: no '${store.categoryTitle}'`);
    await commonChecks(page, store, name('category'));
    note('category: the collection\'s title');
    await shoot(page, name('category'));

    await open(page, store, `/search?q=${encodeURIComponent(store.searchTerm)}`, name('search'));
    const results = await page.evaluate(() => document.body.innerText);
    if (!store.productNames.some((n) => results.includes(n))) fail(`${name('search')}: no result for '${store.searchTerm}'`);
    await commonChecks(page, store, name('search'));
    note('search: a query in the store\'s language finds one of its products');
    await shoot(page, name('search'));

    await open(page, store, '/cart', name('cart'));
    await page.locator('.cart-lines li[data-variant-id]').first().waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
    await commonChecks(page, store, name('cart'));
    note('cart: the line added on the product page is listed');
    await shoot(page, name('cart'));

    await open(page, store, '/checkout', name('checkout'));
    if (!(await page.evaluate(() => document.body.innerText)).includes(t['checkout.title'])) fail(`${name('checkout')}: no title`);
    await commonChecks(page, store, name('checkout'));
    note('checkout: the localized checkout title (the disabled shell of P3.S2)');
    await shoot(page, name('checkout'));

    await open(page, store, '/success', name('success'));
    if (!(await page.evaluate(() => document.body.innerText)).includes(t['success.title'])) fail(`${name('success')}: no title`);
    await commonChecks(page, store, name('success'));
    note('success: the localized thank-you title');
    await shoot(page, name('success'));

    const status = await open(page, store, MISSING_PATH, name('404'), [200, 404]);
    const marker = await visibleText(page, '[data-testid="not-found"]');
    if (!marker.includes(t['notFound.title'])) fail(`${name('404')}: no '${t['notFound.title']}'`);
    if (otherNamesPattern(store).test(await page.evaluate(() => document.body.innerText))) fail(`${name('404')}: another store`);
    note(`404: ${MISSING_PATH} answers the not-found page (HTTP ${status}) with the message in the store's language`);
    await shoot(page, name('404'));
  } finally {
    await context.close();
  }
}

async function compactHome(browser, store, vp) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await open(page, store, '/', `compact-${store.key}-home-${vp}`);
    const sections = await page.evaluate(() =>
      [...document.querySelectorAll('.theme-root[data-page="home"] > [data-section]')].map((s) => s.getAttribute('data-section')),
    );
    if (sections.join() !== COMPACT_HOME_SECTIONS.join())
      fail(`compact-${store.key}-home-${vp}: sections ${sections.join(', ')}, expected ${COMPACT_HOME_SECTIONS.join(', ')}`);
    await commonChecks(page, store, `compact-${store.key}-home-${vp}`);
    note(`compact: the home page renders exactly the compact theme's sections (${COMPACT_HOME_SECTIONS.join(', ')}) with STOREFRONT_THEME=compact on the same image`);
    await shoot(page, `compact-${store.key}-home-${vp}`);
  } finally {
    await context.close();
  }
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const store of stores) {
    for (const vp of Object.keys(VIEWPORTS)) {
      if (mode === 'stores') await storePages(browser, store, vp);
      else if (store.key !== 'fr') await compactHome(browser, store, vp);
    }
  }
} finally {
  await browser.close();
}
