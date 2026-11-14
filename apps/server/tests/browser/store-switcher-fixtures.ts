import { STORE_SWITCHER_TEST_ID } from '@cod/plugin-merchant-shell';
import type { Browser, Page } from 'playwright-core';
import { expect } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsOwner } from './dashboard-session';

const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
/** The owner of the seed's second business, whose stores are foreign to every demo member. */
const SECOND_BUSINESS_OWNER_EMAIL = 'owner@second.example.test';

/** The local channel token of the page. */
export const selectedToken = (page: Page): Promise<string | null> =>
  page.evaluate((key) => localStorage.getItem(key), SELECTED_CHANNEL_KEY);

/** One call of the Admin API with the session of `page`, sent with the channel token the dashboard holds. */
export async function adminApi<T>(page: Page, query: string, variables: object = {}): Promise<T> {
  const answer = await page.evaluate(
    async ([key, document, values]) => {
      const response = await fetch('/admin-api', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
        body: JSON.stringify({ query: document, variables: values }),
      });
      return (await response.json()) as { data?: unknown; errors?: unknown };
    },
    [SELECTED_CHANNEL_KEY, query, variables] as const,
  );
  if (answer.data === undefined || answer.errors !== undefined) {
    throw new Error(`Admin API call failed: ${JSON.stringify(answer.errors)}`);
  }
  return answer.data as T;
}

/** A store as the switcher's own query reports it. */
export interface StoreRow {
  readonly id: string;
  readonly channelId: string;
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
}

/** The stores the session behind `page` can switch to, in id order. */
export async function switchableStores(page: Page): Promise<readonly StoreRow[]> {
  const { switchableStores: answer } = await adminApi<{ switchableStores: { stores: StoreRow[] } }>(
    page,
    'query { switchableStores { stores { id channelId name subdomain language } } }',
  );
  return [...answer.stores].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

/** A real store of another business, read through that business's owner in a context of its own (#176). */
export async function foreignStore(browser: Browser): Promise<StoreRow> {
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await loginAsOwner(otherPage, DASHBOARD_URL, SECOND_BUSINESS_OWNER_EMAIL);
    const [foreign] = await switchableStores(otherPage);
    if (foreign === undefined) throw new Error('the second business has a store');
    return foreign;
  } finally {
    await other.close();
  }
}

/** A disposable store of the signed-in owner's business, named with the run id. */
export async function createDisposableStore(
  page: Page,
  input: { readonly name: string; readonly subdomain: string; readonly language: string },
): Promise<StoreRow> {
  await adminApi(page, 'mutation ($input: CreateStoreInput!) { createStore(input: $input) { id } }', { input });
  const find = async (): Promise<StoreRow | undefined> =>
    (await switchableStores(page)).find((row) => row.subdomain === input.subdomain);
  // The creator's session can take a moment to hold the new channel (D87).
  await expect.poll(find).toBeDefined();
  const store = await find();
  if (store === undefined) throw new Error(`The new store ${input.subdomain} is not switchable`);
  return store;
}

/** Archives a disposable store, through the session behind `page`. */
export async function archiveStore(page: Page, id: string): Promise<void> {
  await adminApi(page, 'mutation ($id: String!) { archiveStore(id: $id) { id } }', { id });
}

/** A member's access, as `setMemberAccess` writes it. */
export interface MemberAccessRow {
  readonly administratorId: string;
  readonly roleIds: readonly string[];
  readonly storeIds: readonly string[];
}

/** Reads a member's access through the owner's session. */
export async function memberAccess(owner: Page, administratorId: string): Promise<MemberAccessRow> {
  const { memberAccess: access } = await adminApi<{
    memberAccess: { roles: { id: string }[]; storeIds: string[] };
  }>(owner, 'query ($id: String!) { memberAccess(administratorId: $id) { roles { id } storeIds } }', {
    id: administratorId,
  });
  return { administratorId, roleIds: access.roles.map((role) => role.id), storeIds: access.storeIds };
}

/** Gives a selected-store member exactly `storeIds`, keeping the roles. */
export async function setSelectedStores(
  owner: Page,
  { administratorId, roleIds }: MemberAccessRow,
  storeIds: readonly string[],
): Promise<void> {
  await adminApi(
    owner,
    'mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId } }',
    { input: { administratorId, roleIds, storeAccess: 'selected', storeIds } },
  );
}

/** The id of the administrator behind `page`. */
export async function ownAdministratorId(page: Page): Promise<string> {
  const { activeAdministrator } = await adminApi<{ activeAdministrator: { id: string } }>(
    page,
    'query { activeAdministrator { id } }',
  );
  return activeAdministrator.id;
}

export const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);

export async function chooseStore(page: Page, subdomain: string): Promise<void> {
  await byTestId(page, STORE_SWITCHER_TEST_ID).click();
  await page.getByRole('menuitem', { name: new RegExp(`${subdomain}$`) }).click();
}

export const switcherSubdomain = (page: Page): Promise<string> =>
  byTestId(page, STORE_SWITCHER_TEST_ID).locator('bdi[dir="ltr"]').innerText();

export const expectSwitcherOn = (page: Page, subdomain: string) =>
  expect.poll(() => switcherSubdomain(page)).toBe(subdomain);

export const tokenChangesFrom = (page: Page, before: string | null) =>
  expect.poll(async () => selectedToken(page)).not.toBe(before);
