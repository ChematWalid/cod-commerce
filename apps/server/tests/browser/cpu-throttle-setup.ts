import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';

/** How many times slower than the host the page's CPU runs, Chrome DevTools' "4x slowdown" by default. */
const DEFAULT_THROTTLE_RATE = 4;

const rate = Number(process.env['BROWSER_CPU_THROTTLE_RATE'] ?? DEFAULT_THROTTLE_RATE);
if (!Number.isFinite(rate) || rate < 1)
  throw new Error(`BROWSER_CPU_THROTTLE_RATE must be 1 or more, not ${String(rate)}`);

/** Marks a patched launcher, since this file runs once per test file in one worker. */
const PATCHED = Symbol.for('cod.browser.cpuThrottle');

async function throttle(context: BrowserContext, page: Page): Promise<Page> {
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });
  return page;
}

function throttlePages(context: BrowserContext): BrowserContext {
  const newPage = context.newPage.bind(context);
  context.newPage = async () => throttle(context, await newPage());
  return context;
}

function throttleBrowser(browser: Browser): Browser {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => throttlePages(await newContext(options));
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (options) => {
    const page = await newPage(options);
    return throttle(page.context(), page);
  };
  return browser;
}

/**
 * Vitest setup for `cpu-throttle.vitest.config.ts`: every page a browser test opens runs under CDP CPU throttling, the
 * way a slow CI runner does (#221). The tests stay unchanged; `chromium.launch` hands out throttled browsers.
 */
const launcher = chromium as typeof chromium & { [PATCHED]?: true };
if (launcher[PATCHED] !== true) {
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (options) => throttleBrowser(await launch(options));
  launcher[PATCHED] = true;
}
