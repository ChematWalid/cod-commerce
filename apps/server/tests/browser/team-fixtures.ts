import { Client } from 'pg';
import type { Browser, Locator, Page } from 'playwright-core';
import { DASHBOARD_URL } from './dashboard-pages';
import { emailSecrets, waitForEmail } from './mailpit';

const MAILPIT_URL = (process.env['MAILPIT_URL'] ?? 'http://localhost:8025').replace(/\/$/, '');
export const TEAM_URL = `${DASHBOARD_URL}/team`;
const ACCEPT_URL = `${DASHBOARD_URL}/accept-invitation`;
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
export const INVITEE_PASSWORD = 'synthetic-invitee-pass';

let sequence = 0;
export const uniqueEmail = (prefix: string): string => {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}${String(sequence)}@invitee.example.test`;
};

/** Calls the Admin API with the signed-in session on its selected store; throws on a GraphQL error. */
export async function adminApi<T>(page: Page, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const answer = await page.evaluate(
    async ([key, body]) => {
      const response = await fetch('/admin-api', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
        body,
      });
      return (await response.json()) as { data?: unknown; errors?: unknown };
    },
    [SELECTED_CHANNEL_KEY, JSON.stringify({ query, variables })] as const,
  );
  if (answer.errors !== undefined) throw new Error(`Admin API refused: ${JSON.stringify(answer.errors)}`);
  return answer.data as T;
}

/** Invites `email` as an Order Manager of every store of the signed-in owner's business, through the API. */
export async function inviteThroughApi(page: Page, email: string): Promise<void> {
  const { businessRoles } = await adminApi<{ businessRoles: { id: string; builtInKey: string | null }[] }>(
    page,
    'query { businessRoles { id builtInKey } }',
  );
  const role = businessRoles.find((candidate) => candidate.builtInKey === 'order-manager');
  if (role === undefined) throw new Error('the business has no Order Manager role');
  const input = { email, roleIds: [role.id], storeAccess: 'all', baseSalary: 30_000, locale: 'en' };
  await adminApi(page, 'mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id } }', { input });
}

/** The token of the newest invitation mail to `email`. */
export async function invitationToken(email: string, minCount = 1): Promise<string> {
  const mail = await waitForEmail(MAILPIT_URL, email, { contains: '/accept-invitation', minCount });
  const { token } = emailSecrets(mail);
  if (token === undefined) throw new Error(`the invitation mail to ${email} has no link token`);
  return token;
}

export const openAcceptPage = async (page: Page, token: string): Promise<void> => {
  await page.goto(`${ACCEPT_URL}?token=${token}`);
  await page.locator('[data-testid="accept-invitation-page"]').waitFor();
};

export const memberRow = (page: Page, email: string): Locator => page.getByRole('row').filter({ hasText: email });

/** Invites `email` into the signed-in owner's business and accepts the mailed link in a context of its own. */
export async function addActiveMember(browser: Browser, page: Page, email: string): Promise<void> {
  await inviteThroughApi(page, email);
  const invitee = await (await browser.newContext()).newPage();
  await openAcceptPage(invitee, await invitationToken(email));
  await invitee.getByRole('textbox', { name: 'First name' }).fill('Samir');
  await invitee.getByRole('textbox', { name: 'Last name' }).fill('Haddad');
  await invitee.getByLabel('Password').fill(INVITEE_PASSWORD);
  await invitee.getByRole('button', { name: 'Create account' }).click();
  await invitee.waitForURL((url) => url.pathname.endsWith('/login'));
  await invitee.context().close();
}

/** Makes every open invitation of `email` run out, as seven days would (D205). */
export async function expireInvitationsOf(email: string): Promise<void> {
  const client = new Client({ connectionString: process.env['DATABASE_URL_DIRECT'] });
  await client.connect();
  try {
    await client.query(
      `UPDATE invitation SET "expiresAt" = now() - interval '1 day'
        WHERE "memberId" IN (SELECT id FROM team_member WHERE "emailKey" = $1)`,
      [email],
    );
  } finally {
    await client.end();
  }
}
