import { BUILT_IN_ROLES } from '@cod/shared';
import { Client } from 'pg';
import { type Browser, chromium, type Locator, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import { emailSecrets, waitForEmail } from './mailpit';

const MAILPIT_URL = (process.env['MAILPIT_URL'] ?? 'http://localhost:8025').replace(/\/$/, '');
const TEAM_URL = `${DASHBOARD_URL}/team`;
const ACCEPT_URL = `${DASHBOARD_URL}/accept-invitation`;
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
const SECOND_OWNER_EMAIL = 'owner@second.example.test';
/** The first demo business's name, which an invitee of the second one must never be shown (D201). */
const DEMO_BUSINESS_NAME = 'Demo';
const INVITEE_PASSWORD = 'synthetic-invitee-pass';

const orderManager = BUILT_IN_ROLES.find((role) => role.key === 'order-manager');
if (orderManager === undefined) throw new Error('the catalog lost the order-manager role');

/** The accept page's copy (`plugins/team/dashboard/i18n`), in English and Arabic. */
const COPY = {
  invalid: {
    en: 'This invitation link cannot be used. Ask for a new invitation.',
    ar: 'لا يمكن استخدام رابط الدعوة هذا. اطلب دعوة جديدة.',
  },
  elsewhere: {
    en: 'This email already belongs to another business. Use a different email to join.',
    ar: 'هذا البريد الإلكتروني مرتبط بنشاط تجاري آخر. استخدم بريدًا إلكترونيًا مختلفًا للانضمام.',
  },
} as const;

let sequence = 0;
const uniqueEmail = (prefix: string): string => {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}${String(sequence)}@invitee.example.test`;
};

/** Calls the Admin API with the signed-in session on its selected store; throws on a GraphQL error. */
async function adminApi<T>(page: Page, query: string, variables: Record<string, unknown> = {}): Promise<T> {
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
async function inviteThroughApi(page: Page, email: string): Promise<void> {
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
async function invitationToken(email: string, minCount = 1): Promise<string> {
  const mail = await waitForEmail(MAILPIT_URL, email, { contains: '/accept-invitation', minCount });
  const { token } = emailSecrets(mail);
  if (token === undefined) throw new Error(`the invitation mail to ${email} has no link token`);
  return token;
}

/** Makes every open invitation of `email` run out, as seven days would (D205). */
async function expireInvitationsOf(email: string): Promise<void> {
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

const switchPublicLanguage = (page: Page, language: 'ar' | 'en'): Promise<void> =>
  page.getByRole('button', { name: language === 'ar' ? 'العربية' : 'English', exact: true }).click();

const openAcceptPage = async (page: Page, token: string): Promise<void> => {
  await page.goto(`${ACCEPT_URL}?token=${token}`);
  await page.locator('[data-testid="accept-invitation-page"]').waitFor();
};

/** The page shows `copy` in English, then in Arabic after the language switch. */
async function expectMessageInBothLanguages(page: Page, copy: { en: string; ar: string }): Promise<void> {
  await page.getByText(copy.en, { exact: true }).waitFor();
  await switchPublicLanguage(page, 'ar');
  await page.getByText(copy.ar, { exact: true }).waitFor();
}

const memberRow = (page: Page, email: string): Locator => page.getByRole('row').filter({ hasText: email });

describe('team members page and invitation', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await (await browser.newContext()).newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  it('keeps Send invitation disabled and asks for a role while none is chosen', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
    await page.goto(TEAM_URL);
    await page.getByRole('button', { name: 'Invite team member', exact: true }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('no-role'));
    await dialog.getByRole('textbox', { name: 'Base salary (DZD) *' }).fill('30000');

    await dialog.getByText('Choose at least one role.', { exact: true }).waitFor();
    await expect(dialog.getByRole('button', { name: 'Send invitation' }).isDisabled()).resolves.toBe(true);
  });

  it('invites from the dialog, accepts from the mailed link and lists the member as active', async () => {
    const email = uniqueEmail('happy');
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
    await page.goto(TEAM_URL);
    await page.getByRole('button', { name: 'Invite team member', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Email' }).fill(email);
    await dialog.getByRole('checkbox', { name: orderManager.label.en, exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Base salary (DZD) *' }).fill('30000');
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await memberRow(page, email).getByText('Pending', { exact: true }).waitFor();

    const invitee = await (await browser.newContext()).newPage();
    await openAcceptPage(invitee, await invitationToken(email));
    await expect.poll(() => new URL(invitee.url()).search).toBe('');
    await invitee.getByRole('textbox', { name: 'First name' }).fill('Amina');
    await invitee.getByRole('textbox', { name: 'Last name' }).fill('Saadi');
    await invitee.getByLabel('Password').fill(INVITEE_PASSWORD);
    await invitee.getByRole('button', { name: 'Create account' }).click();
    await invitee.waitForURL((url) => url.pathname.endsWith('/login'));
    await invitee.context().close();

    await page.reload();
    await memberRow(page, email).getByText('Active', { exact: true }).waitFor();
  });

  it('refuses a reused link in English and Arabic, and drops the token from the address', async () => {
    const email = uniqueEmail('reused');
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await inviteThroughApi(page, email);
    const token = await invitationToken(email);
    const invitee = await (await browser.newContext()).newPage();
    await openAcceptPage(invitee, token);
    await invitee.getByRole('textbox', { name: 'First name' }).fill('Reda');
    await invitee.getByRole('textbox', { name: 'Last name' }).fill('Bouzid');
    await invitee.getByLabel('Password').fill(INVITEE_PASSWORD);
    await invitee.getByRole('button', { name: 'Create account' }).click();
    await invitee.waitForURL((url) => url.pathname.endsWith('/login'));
    await invitee.context().close();

    await openAcceptPage(page, token);

    await expect.poll(() => new URL(page.url()).search).toBe('');
    await expectMessageInBothLanguages(page, COPY.invalid);
  });

  it('refuses an expired link in English and Arabic', async () => {
    const email = uniqueEmail('expired');
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await inviteThroughApi(page, email);
    const token = await invitationToken(email);
    await expireInvitationsOf(email);
    const invitee = await (await browser.newContext()).newPage();

    await openAcceptPage(invitee, token);

    await expect.poll(() => new URL(invitee.url()).search).toBe('');
    await expectMessageInBothLanguages(invitee, COPY.invalid);
    await invitee.context().close();
  });

  it('tells an invitee with an account in another business so, naming neither business (D201)', async () => {
    const email = uniqueEmail('elsewhere');
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await inviteThroughApi(page, email);
    const invitee = await (await browser.newContext()).newPage();
    await openAcceptPage(invitee, await invitationToken(email));
    await invitee.getByRole('textbox', { name: 'First name' }).fill('Nadia');
    await invitee.getByRole('textbox', { name: 'Last name' }).fill('Kaci');
    await invitee.getByLabel('Password').fill(INVITEE_PASSWORD);
    await invitee.getByRole('button', { name: 'Create account' }).click();
    await invitee.waitForURL((url) => url.pathname.endsWith('/login'));
    await page.context().close();
    page = await (await browser.newContext()).newPage();
    await loginAsOwner(page, DASHBOARD_URL, SECOND_OWNER_EMAIL);
    await inviteThroughApi(page, email);

    await openAcceptPage(invitee, await invitationToken(email, 2));
    await invitee.getByRole('textbox', { name: 'First name' }).fill('Nadia');
    await invitee.getByRole('textbox', { name: 'Last name' }).fill('Kaci');
    await invitee.getByLabel('Password').fill(INVITEE_PASSWORD);
    await invitee.getByRole('button', { name: 'Create account' }).click();

    await expectMessageInBothLanguages(invitee, COPY.elsewhere);
    const text = await invitee.locator('body').innerText();
    expect(text).not.toMatch(new RegExp(`\\b${DEMO_BUSINESS_NAME}\\b`));
    await invitee.context().close();
  });
});
