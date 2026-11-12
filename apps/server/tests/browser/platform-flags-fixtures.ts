import { FLAG_KEYS } from '@cod/shared';
import type { Browser, Page } from 'playwright-core';
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
