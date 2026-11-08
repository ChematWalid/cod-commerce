// Screenshot helper of scripts/evidence/P0.S2b-5.sh (CLAUDE.md §3a.14): drives the live storefront of the
// cod-evidence stack in Chromium and writes the 6 PNGs plus the README's screenshot table.
//
//   node scripts/evidence/storefront-screens.mjs <storefront-port> <out-dir> <table-fragment-file>
//
// Chromium resolves every *.localhost name to the loopback address, so the store is picked by the Host header
// the browser sends, exactly as in production. The stores, the unknown host and the page markers come from the
// constants block of P0.S2b-5.sh (environment variables); they are checked here against the demo seed and the
// storefront's source (the modules are not importable from plain Node: their imports have no file extensions), so
// a drift fails the run instead of screenshotting the wrong thing.
/* global process, console, URL, document, requestAnimationFrame -- Node globals, and browser globals inside page.evaluate callbacks */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/storefront/package.json'))('playwright-core');

const [port, outDir, tableFile] = process.argv.slice(2);
if (!port || !outDir || !tableFile)
  throw new Error('usage: storefront-screens.mjs <port> <out-dir> <table-fragment-file>');

const MAX_BYTES = 300 * 1024;

/** @returns {string} the environment variable `name`, set by P0.S2b-5.sh's constants block */
function fromEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run this through scripts/evidence/P0.S2b-5.sh`);
  return value;
}

const storeFromEnv = (prefix) => ({
  name: fromEnv(`${prefix}_STORE_NAME`),
  locale: fromEnv(`${prefix}_STORE_LOCALE`),
  host: fromEnv(`${prefix}_STORE_HOST`),
});
/** `data-testid` values of apps/storefront/app (the tenant page heading and app/not-found.tsx). */
const STORE_NAME_TEST_ID = fromEnv('STORE_NAME_TEST_ID');
const NOT_FOUND_TEST_ID = fromEnv('NOT_FOUND_TEST_ID');
const NOT_FOUND_TEXT = fromEnv('NOT_FOUND_TEXT');
/** A host no store owns. */
const UNKNOWN_HOST = fromEnv('UNKNOWN_HOST');

const VIEWPORTS = {
  desktop: {
    label: 'desktop 1280x800, scale 1',
    options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  },
  mobile: {
    label: 'mobile 390x844, touch, scale 2',
    options: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  },
};

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

/** Fails unless the demo seed declares this store with this name and language. */
function assertSeeded(store, seedSource) {
  const subdomain = store.host.split('.')[0];
  const declaration = `{ name: '${store.name}', subdomain: '${subdomain}', language: '${store.locale}' }`;
  if (!seedSource.includes(declaration)) fail(`the demo seed no longer declares ${declaration}`);
}

/** The stores of the script's constants block, after checking them and the page markers against the source. */
function readStores() {
  const stores = [storeFromEnv('DEMO'), storeFromEnv('SECOND')];
  const seedSource = readFileSync(join(root, 'apps/server/src/seed/seed-demo-businesses.ts'), 'utf8');
  stores.forEach((store) => assertSeeded(store, seedSource));
  if (stores.some((s) => s.host === UNKNOWN_HOST)) fail(`${UNKNOWN_HOST} belongs to a store`);
  const notFoundCopy = readFileSync(join(root, 'apps/storefront/src/i18n/storefront-locale-copy.ts'), 'utf8');
  const notFoundContent = readFileSync(join(root, 'apps/storefront/src/i18n/not-found-content.tsx'), 'utf8');
  if (!notFoundCopy.includes(NOT_FOUND_TEXT) || !notFoundContent.includes(`data-testid="${NOT_FOUND_TEST_ID}"`))
    fail(`the not-found page no longer renders data-testid="${NOT_FOUND_TEST_ID}" with '${NOT_FOUND_TEXT}'`);
  const tenantPage = readFileSync(join(root, 'apps/storefront/app/%5Ft/[storeId]/[locale]/page.tsx'), 'utf8');
  if (!tenantPage.includes(`data-testid="${STORE_NAME_TEST_ID}"`))
    fail(`the tenant page no longer renders data-testid="${STORE_NAME_TEST_ID}"`);
  return stores;
}

/** Waits for two animation frames: the DOM is complete before the first paint, and an early shot is blank. */
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

/**
 * Opens `http://<host>:<port>/` and fails unless the main document has `status`, the marker element is
 * visible with `text`, and none of `absentTexts` is in the document. Then saves the viewport PNG.
 */
async function shoot(browser, vpName, spec) {
  const url = `http://${spec.host}:${port}/`;
  const label = `${spec.file}-${vpName}`;
  const context = await browser.newContext({ ...VIEWPORTS[vpName].options, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'load' });
    if (response?.status() !== spec.status)
      fail(`${label}: ${url} answered ${response?.status()}, expected ${spec.status}`);
    const redirectedFrom = response.request().redirectedFrom();
    if (redirectedFrom) fail(`${label}: ${url} was reached through a redirect from ${redirectedFrom.url()}`);
    if (page.url() !== url) fail(`${label}: the page ended at ${page.url()}, expected ${url}`);
    const marker = page.getByTestId(spec.testId);
    await marker.waitFor({ state: 'visible' });
    const text = (await marker.textContent())?.trim();
    if (spec.contains ? !text?.includes(spec.text) : text !== spec.text)
      fail(`${label}: ${spec.testId} shows '${text}', expected '${spec.text}'`);
    const html = await page.content();
    const visible = await page.evaluate(() => document.body.innerText);
    for (const absent of spec.absentTexts) {
      if (html.includes(absent) || visible.includes(absent)) fail(`${label}: '${absent}' appears in the page`);
    }
    await settle(page);
    const file = join(outDir, `${spec.file}-${vpName}.png`);
    await page.screenshot({ path: file });
    const size = statSync(file).size;
    if (size > MAX_BYTES) fail(`${file} is ${size} bytes, over ${MAX_BYTES}`);
    console.log(`${spec.file}-${vpName}.png\t${size}\t${url}\t${response.status()}`);
  } finally {
    await context.close();
  }
}

const stores = readStores();
const specs = [
  ...stores.map((store) => ({
    file: store.host.split('.')[0],
    host: store.host,
    status: 200,
    testId: STORE_NAME_TEST_ID,
    text: store.name,
    absentTexts: stores.filter((other) => other !== store).map((other) => other.name),
    note: `${store.name} (store locale \`${store.locale}\`)`,
  })),
  {
    file: 'not-found',
    host: UNKNOWN_HOST,
    status: 404,
    testId: NOT_FOUND_TEST_ID,
    text: NOT_FOUND_TEXT,
    contains: true,
    absentTexts: stores.map((s) => s.name),
    note: 'the not-found page (unknown host)',
  },
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const spec of specs) for (const vpName of Object.keys(VIEWPORTS)) await shoot(browser, vpName, spec);
} finally {
  await browser.close();
}

const pngs = readdirSync(outDir).filter((f) => f.endsWith('.png'));
if (pngs.length !== 6) fail(`expected 6 PNGs, found ${pngs.length}`);

const rows = [];
for (const spec of specs) {
  for (const vpName of Object.keys(VIEWPORTS)) {
    const name = `${spec.file}-${vpName}.png`;
    const absent = spec.absentTexts.map((t) => `\`${t}\``).join(', ');
    rows.push(
      `| [\`${name}\`](screens/${name}) | \`http://${spec.host}:${port}/\` | ${VIEWPORTS[vpName].label} | ${spec.status} | ${spec.note}: \`${spec.testId}\` visible with \`${spec.text}\`; ${absent} absent |`,
    );
  }
}
writeFileSync(tableFile, `${rows.join('\n')}\n`);
