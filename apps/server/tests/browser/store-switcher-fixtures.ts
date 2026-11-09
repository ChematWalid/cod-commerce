import type { Page } from 'playwright-core';

const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';

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

/** A disposable store of the signed-in owner's business, named with the run id. */
export async function createDisposableStore(
  page: Page,
  input: { readonly name: string; readonly subdomain: string; readonly language: string },
): Promise<StoreRow> {
  await adminApi(page, 'mutation ($input: CreateStoreInput!) { createStore(input: $input) { id } }', { input });
  const store = (await switchableStores(page)).find((row) => row.subdomain === input.subdomain);
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
