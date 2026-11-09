import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { png } from './image-fixtures';
import { createProfileTestKit } from './profile-test-kit';
import { codeOf, uniqueEmail, uniqueIp } from './register-test-kit';
import { createPairHarness, type Side, snapshotOf } from './two-business-kit';
import {
  ASSET_NOT_AVAILABLE,
  CONFIRM,
  FORGOT,
  NEW_PASSWORD,
  PROFILE,
  REQUEST,
  RESEND,
  RESET,
  STATUS,
  SUCCESS,
  UPDATE_BUSINESS,
  UPDATE_STORE,
  VERIFY,
  VERIFY_OTP,
} from './two-business-queries';
import { leaksOf } from './two-business-kit';

const kit = createProfileTestKit();
const { client } = kit;
const { withFreshPair, leavesUntouched, openVerificationOf, loginCode } = createPairHarness(kit);
let a: Side;
let b: Side;

const pairInto = (pair: { a: Side; b: Side }): void => {
  ({ a, b } = pair);
};

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe("a token of B in A's hands changes B only through its own flow", () => {
  withFreshPair(pairInto);
  it('verifyEmail with the link of B, sent by A, verifies B, tells A nothing of B and leaves A as it was', async () => {
    // Arrange
    const { token } = await openVerificationOf(b);
    const before = await snapshotOf(kit, a);

    // Act
    const answer = await client.graphql(VERIFY, { token }, a.session);
    const replay = await client.rest(`/auth/verify-email/${token}`, {}, a.session);

    // Assert
    expect(answer.data).toEqual({ verifyEmail: SUCCESS });
    expect(leaksOf(answer, b)).toEqual([]);
    expect(await replay.json()).toMatchObject({ code: AUTH_ERROR_CODES.INVALID_TOKEN });
    expect(await kit.status(b.session)).toMatchObject({ emailVerified: true });
    expect(await kit.status(a.session)).toMatchObject({ emailVerified: false });
    expect(await snapshotOf(kit, a)).toEqual(before);
  });

  it('verifyEmailOtp with the code of B, sent by A, is refused, spends nothing of B, and B still verifies', async () => {
    // Arrange
    const { code } = await openVerificationOf(b);

    // Act
    await leavesUntouched(b, async () => {
      const answer = await client.graphql(VERIFY_OTP, { code }, a.session);
      const rest = await client.rest('/auth/verify-email-otp', { code }, a.session);
      expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
      expect(await rest.json()).toMatchObject({ code: AUTH_ERROR_CODES.OTP_INVALID });
    });
    const own = await client.graphql(VERIFY_OTP, { code }, b.session);

    // Assert
    expect(own.data).toEqual({ verifyEmailOtp: SUCCESS });
  });

  it('confirmEmailChange with the link of B, sent by A, moves B only and leaves A as it was', async () => {
    // Arrange
    const target = uniqueEmail();
    await client.graphql(REQUEST, { email: target, password: b.password }, b.session);
    const token = await kit.tokenInMail(target);
    const before = await snapshotOf(kit, a);

    // Act
    const answer = await client.graphql(CONFIRM, { token }, a.session);

    // Assert
    expect(answer.data).toEqual({ confirmEmailChange: SUCCESS });
    expect(leaksOf(answer, b)).toEqual([]);
    expect((await client.login(target, b.password, { ip: uniqueIp() })).code).toBe('OK');
    expect(await client.me(a.session)).toBe(a.email);
    expect(await snapshotOf(kit, a)).toEqual(before);
  });

  it('resetPassword with the link of B, sent by A, resets B only: A keeps the session and the password', async () => {
    // Arrange
    await client.graphql(FORGOT, { email: b.email }, { ip: uniqueIp() });
    const token = await kit.tokenInMail(b.email);
    const before = await snapshotOf(kit, a);

    // Act
    const answer = await client.graphql(RESET, { token, password: NEW_PASSWORD }, a.session);

    // Assert
    expect(answer.data?.['resetPassword']).toEqual({ __typename: 'CurrentUser', identifier: b.email });
    expect(await loginCode(b)).toBe('INVALID_CREDENTIALS_ERROR');
    expect(await loginCode(b, NEW_PASSWORD)).toBe('OK');
    expect(await client.me(a.session)).toBe(a.email);
    expect(await snapshotOf(kit, a)).toEqual(before);
    expect(await loginCode(a)).toBe('OK');
  });
});

describe('the logo of one business', () => {
  withFreshPair(pairInto);
  it('uploadBusinessLogo as A naming either channel of B is FORBIDDEN and stores no asset', async () => {
    // Arrange
    const assets = async (): Promise<number> =>
      Number((await kit.sql<{ count: string }>('SELECT count(*) AS count FROM "asset"'))[0]?.count);
    const before = await assets();

    // Act
    const answers = [];
    for (const store of b.business.stores) {
      answers.push(await kit.uploadLogo({ ...a.session, channelToken: store.channelToken }, png()));
    }

    // Assert
    expect(answers.map(codeOf)).toEqual(['FORBIDDEN', 'FORBIDDEN']);
    expect(await assets()).toBe(before);
  });

  it('cannot be attached to the business or either store of B, whichever store of A it was uploaded on', async () => {
    // Arrange
    const uploaded: string[] = [];
    for (const store of a.business.stores) {
      const answer = await kit.uploadLogo({ ...a.session, channelToken: store.channelToken }, png());
      uploaded.push(String(answer.data?.['uploadBusinessLogo']?.['assetId']));
    }

    // Act and Assert
    await leavesUntouched(b, async () => {
      for (const assetId of uploaded) {
        const business = await client.graphql(UPDATE_BUSINESS, { input: { logoAssetId: assetId } }, b.onStore);
        expect(codeOf(business)).toBe(ASSET_NOT_AVAILABLE);
        for (const store of b.business.stores) {
          const input = { logoAssetId: assetId };
          const update = await client.graphql(UPDATE_STORE, { id: store.id, input }, b.onStore);
          expect(codeOf(update)).toBe(ASSET_NOT_AVAILABLE);
        }
      }
    });
  });
});

describe('account_token rows are nobody else', () => {
  withFreshPair(pairInto);
  it("shows A no hash, id, code, link or address of B's open tokens in any answer", async () => {
    // Arrange
    const { token, code } = await openVerificationOf(b);
    const target = uniqueEmail();
    await client.graphql(REQUEST, { email: target, password: b.password }, b.session);
    const rows = await kit.sql<{ id: string; tokenHash: string; otpHash: string | null }>(
      'SELECT "id", "tokenHash", "otpHash" FROM "account_token" WHERE "userId" = $1',
      [b.userId],
    );
    const secrets = [token, code, target, ...rows.flatMap((row) => [row.id, row.tokenHash, row.otpHash ?? ''])];

    // Act
    const answers = [
      await client.graphql(STATUS, {}, a.session),
      await client.graphql(PROFILE, {}, a.session),
      await client.graphql(RESEND, {}, a.session),
      await client.graphql(VERIFY_OTP, { code }, a.session),
      await client.graphql(VERIFY, { token }, a.session),
      await client.graphql(REQUEST, { email: b.email, password: a.password }, a.session),
      await client.json('GET', '/auth/profile', a.session),
      await (await client.rest('/auth/verify-email-otp', { code }, a.session)).json(),
    ];

    // Assert
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const text = JSON.stringify(answers);
    expect(secrets.filter((secret) => secret !== '' && text.includes(secret))).toEqual([]);
  });
});
