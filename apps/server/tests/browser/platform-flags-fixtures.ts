import { FLAG_KEYS } from '@cod/shared';
import type { Browser, Page, Request } from 'playwright-core';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner } from './dashboard-session';

export const FLAGS_URL = `${DASHBOARD_URL}/platform/flags`;
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';

const AI = FLAG_KEYS.ai;

export const flagRow = (page: Page, key: string) => page.locator(`[data-testid="flag-row-${key}"]`);
export const defaultSwitch = (page: Page, key: string) => page.locator(`[data-testid="flag-default-${key}"]`);
export const rolloutInput = (page: Page, key: string) => page.locator(`[data-testid="flag-rollout-${key}"]`);
export const overridesToggle = (page: Page, key: string) => page.locator(`[data-testid="flag-overrides-${key}"]`);

export const isFlagMutation = (name: string) => (response: { request: () => { postData: () => string | null } }) =>
  response.request().postData()?.includes(name) ?? false;

/** What the Admin API answers: the data is narrowed where it is read. */
export interface AdminAnswer {
  readonly data?: unknown;
  readonly errors?: readonly { readonly message: string }[];
}

/** Posts a GraphQL document to the Admin API as the signed-in user and returns the parsed body. */
export function adminApi(page: Page, query: string): Promise<AdminAnswer> {
  return page.evaluate(
    async ([key, document]) => {
      const response = await fetch('/admin-api', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
        body: JSON.stringify({ query: document }),
      });
      return (await response.json()) as AdminAnswer;
    },
    [SELECTED_CHANNEL_KEY, query] as const,
  );
}

export async function openFlags(page: Page): Promise<void> {
  await page.goto(FLAGS_URL, { waitUntil: 'domcontentloaded' });
  await flagRow(page, AI).waitFor();
}

/** The id of the demo business, read as its owner would. */
export async function demoBusinessId(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const answer = await adminApi(page, 'query { switchableStores { stores { businessId } } }');
    const data = answer.data as { switchableStores: { stores: { businessId: string }[] } } | undefined;
    const id = data?.switchableStores.stores[0]?.businessId;
    if (id === undefined) throw new Error('the demo owner should reach a store');
    return id;
  } finally {
    await context.close();
  }
}

/** The bodies of the `updateFeatureFlag` requests the page sends from now on. */
export function trackFlagUpdates(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.postData()?.includes('updateFeatureFlag')) sent.push(request.postData() ?? '');
  });
  return sent;
}

/** How long a second save is waited for before "saved once" is believed. */
const SECOND_SAVE_SETTLE_MS = 750;

/**
 * Starts watching for another `updateFeatureFlag` request: settles after a bounded wait when none came, and rejects at
 * once when one does. Call it before the action that must not send a second request, await it after.
 */
export function rejectsOnFlagUpdate(page: Page): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onRequest = (request: Request): void => {
      if (request.postData()?.includes('updateFeatureFlag') !== true) return;
      clearTimeout(timer);
      page.off('request', onRequest);
      reject(new Error('A second updateFeatureFlag request was sent'));
    };
    const timer = setTimeout(() => {
      page.off('request', onRequest);
      resolve();
    }, SECOND_SAVE_SETTLE_MS);
    page.on('request', onRequest);
  });
}

/** Puts a flag's rollout back to 100 percent, the seeded value. */
export async function resetRollout(page: Page, key: string): Promise<void> {
  await adminApi(page, `mutation { updateFeatureFlag(input: { key: "${key}", rolloutPercent: 100 }) { key } }`);
}
