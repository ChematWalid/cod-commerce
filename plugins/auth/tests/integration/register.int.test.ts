import { CreateStoreService } from '@cod/plugin-tenancy';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_TOKEN_REPOSITORY } from '../../application/tokens';
import type { AccountTokenRepositoryPort } from '../../domain/ports/account-token-repository.port';
import { AUTH_TOKEN_HEADER } from './login-test-client';
import { messagesTo, waitForMessages } from './mailpit';
import {
  codeOf,
  createRegisterTestKit,
  inputFor,
  PASSWORD,
  uniqueEmail,
  uniqueIp,
  uniqueSubdomain,
} from './register-test-kit';

const QUIET_PERIOD_MS = 1500;

const { server, client, register, counts, administratorsNamed, start } = createRegisterTestKit();

const quietPeriod = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, QUIET_PERIOD_MS));

beforeAll(start);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.destroy();
});

describe('registerMerchant', () => {
  it('creates the administrator, business, store, channel and seller, and no session', async () => {
    // Arrange
    const input = inputFor();
    const before = await counts();

    // Act
    const answer = await register(input);

    // Assert
    expect(answer.errors).toEqual([]);
    expect(answer.data?.['registerMerchant']).toMatchObject({ verificationEmailSent: true });
    expect(answer.headers.get(AUTH_TOKEN_HEADER)).toBeNull();
    const after = await counts();
    for (const table of ['user', 'administrator', 'business', 'store', 'channel', 'seller', 'role']) {
      expect(after[table], table).toBe((before[table] ?? 0) + 1);
    }
  });

  it('gives the owner only the role of the new store, unverified', async () => {
    // Arrange
    const input = inputFor();

    // Act
    const answer = await register(input);

    // Assert
    const businessId = answer.data?.['registerMerchant']?.['businessId'] as string;
    const [administrator] = await administratorsNamed(input['email'] as string);
    const roles = administrator?.user.roles ?? [];
    expect(roles.map((role) => role.code)).toEqual([`owner-${businessId}`]);
    expect(roles[0]?.channels).toHaveLength(1);
    expect((administrator?.customFields as { emailVerifiedAt: Date | null }).emailVerifiedAt).toBeNull();
  });

  it('lets the new owner log in', async () => {
    // Arrange
    const input = inputFor();
    await register(input);

    // Act
    const login = await client.login(input['email'] as string, PASSWORD, { ip: uniqueIp() });

    // Assert
    expect(login.code).toBe('OK');
  });

  it.each(['ar', 'en'])('mails the verification link and code in %s', async (emailLocale) => {
    // Arrange
    const input = inputFor({ emailLocale });

    // Act
    await register(input);
    const [message] = await waitForMessages(input['email'] as string);

    // Assert
    expect(message?.Subject).toBe(`verification/${emailLocale}`);
    expect(message?.Text).toContain('https://dash.example.test/dashboard/verify-email?token=');
    expect(message?.Text).toMatch(/code=\d{6}/);
  });

  it('stores the chosen email locale', async () => {
    // Arrange
    const input = inputFor({ emailLocale: 'en' });

    // Act
    await register(input);

    // Assert
    const [administrator] = await administratorsNamed(input['email'] as string);
    expect((administrator?.customFields as { emailLocale: string }).emailLocale).toBe('en');
  });

  it('treats an email in mixed case with spaces as the same account', async () => {
    // Arrange
    const input = inputFor();
    const email = input['email'] as string;
    await register(input);
    const before = await counts();

    // Act
    const answer = await register(inputFor({ email: `  ${email.toUpperCase()} ` }));

    // Assert
    expect(codeOf(answer)).toBe('auth.email-taken');
    expect(await counts()).toEqual(before);
  });
});

describe('registration atomicity', () => {
  it('leaves nothing and sends nothing when the token insert fails after provisioning', async () => {
    // Arrange
    const input = inputFor();
    const before = await counts();
    vi.spyOn(server.app.get<AccountTokenRepositoryPort>(ACCOUNT_TOKEN_REPOSITORY), 'replaceOpen').mockRejectedValueOnce(
      new Error('forced token failure'),
    );

    // Act
    const answer = await register(input);
    await quietPeriod();

    // Assert
    expect(answer.errors).not.toEqual([]);
    expect(await counts()).toEqual(before);
    expect(await messagesTo(input['email'] as string)).toHaveLength(0);
  });

  it('leaves nothing and sends nothing when the store step fails', async () => {
    // Arrange
    const input = inputFor();
    const before = await counts();
    vi.spyOn(server.app.get(CreateStoreService), 'createIn').mockRejectedValueOnce(new Error('forced store failure'));

    // Act
    const answer = await register(input);
    await quietPeriod();

    // Assert
    expect(answer.errors).not.toEqual([]);
    expect(await counts()).toEqual(before);
    expect(await messagesTo(input['email'] as string)).toHaveLength(0);
  });

  it('creates no business for a taken subdomain', async () => {
    // Arrange
    const first = inputFor();
    await register(first);
    const before = await counts();

    // Act
    const answer = await register(inputFor({ subdomain: first['subdomain'] }));

    // Assert
    expect(codeOf(answer)).toBe('tenancy.subdomain-taken');
    expect(await counts()).toEqual(before);
  });

  it('answers a taken email and creates nothing', async () => {
    // Arrange
    const first = inputFor();
    await register(first);
    const before = await counts();

    // Act
    const answer = await register(inputFor({ email: first['email'] }));

    // Assert
    expect(codeOf(answer)).toBe('auth.email-taken');
    expect(await counts()).toEqual(before);
  });
});

describe('concurrent registration', () => {
  it('yields exactly one account for two registrations of one email', async () => {
    // Arrange
    const email = uniqueEmail();
    const before = await counts();

    // Act
    const answers = await Promise.all([register(inputFor({ email })), register(inputFor({ email }))]);

    // Assert
    expect(answers.map(codeOf).sort()).toEqual(['auth.email-taken', undefined].sort());
    expect(await administratorsNamed(email)).toHaveLength(1);
    const after = await counts();
    for (const table of ['user', 'administrator', 'business', 'store', 'channel', 'seller']) {
      expect(after[table], table).toBe((before[table] ?? 0) + 1);
    }
  });

  it('yields one winner and no orphan for two emails racing for one subdomain', async () => {
    // Arrange
    const subdomain = uniqueSubdomain();
    const before = await counts();

    // Act
    const answers = await Promise.all([register(inputFor({ subdomain })), register(inputFor({ subdomain }))]);

    // Assert
    expect(answers.map(codeOf).sort()).toEqual(['tenancy.subdomain-taken', undefined].sort());
    const after = await counts();
    for (const table of ['user', 'administrator', 'business', 'store', 'channel', 'seller', 'role']) {
      expect(after[table], table).toBe((before[table] ?? 0) + 1);
    }
  });
});
