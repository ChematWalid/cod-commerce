// Screenshot helper of scripts/evidence/P0.S2b-5.sh (CLAUDE.md §3a.14): drives the live storefront of the
// cod-evidence stack in Chromium and writes the 6 PNGs plus the README's screenshot table.
//
//   node scripts/evidence/storefront-screens.mjs <storefront-port> <out-dir> <table-fragment-file>
//
// Chromium resolves every *.localhost name to the loopback address, so the store is picked by the Host header
// the browser sends, exactly as in production. The stores are read from the storefront's own STUB_STORES
// source (the module is not importable from plain Node: its imports have no file extensions), so the
// names, hosts and locales are not duplicated here.
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
/** `data-testid` values of apps/storefront/app (the tenant page heading and app/not-found.tsx). */
const STORE_NAME_TEST_ID = 'store-name';
const NOT_FOUND_TEST_ID = 'not-found';
/** A host no store owns. */
const UNKNOWN_HOST = 'nope.localhost';

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

/** The stub stores, parsed from the storefront source. */
function readStubStores() {
  const source = readFileSync(join(root, 'apps/storefront/src/tenancy/stub-store-resolver.ts'), 'utf8');
  const pattern =
    /storeId: '([^']+)',[\s\S]*?name: '([^']+)',\s*defaultLocale: toStoreLocale\('([^']+)'\),\s*primaryHost: '([^']+)'/g;
  const stores = [...source.matchAll(pattern)].map(([, storeId, name, locale, host]) => ({
    storeId,
    name,
    locale,
    host,
  }));
  if (stores.length !== 2) fail(`expected 2 stub stores in the storefront source, parsed ${stores.length}`);
  if (stores.some((s) => s.host === UNKNOWN_HOST)) fail(`${UNKNOWN_HOST} belongs to a store`);
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
    const marker = page.getByTestId(spec.testId);
    await marker.waitFor({ state: 'visible' });
    const text = (await marker.textContent())?.trim();
    if (text !== spec.text) fail(`${label}: ${spec.testId} shows '${text}', expected '${spec.text}'`);
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

const stores = readStubStores();
const specs = [
  ...stores.map((store) => ({
    file: store.storeId,
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
    text: 'Page not found',
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
