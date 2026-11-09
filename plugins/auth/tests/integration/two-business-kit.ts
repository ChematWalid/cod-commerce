import { createTwoBusinesses, type BusinessFixture } from '@cod/testing';
import { beforeEach, expect } from 'vitest';
import type { AccountFlowKit } from './account-flow-kit';
import type { Caller } from './login-test-client';
import { messagesTo } from './mailpit';
import { uniqueIp } from './register-test-kit';
import { RESEND } from './two-business-queries';

/** One side of the pair: a fixture business, its owner's session and the owner's user id. */
export interface Side {
  readonly business: BusinessFixture;
  readonly email: string;
  readonly password: string;
  readonly userId: number;
  readonly session: Caller;
  /** The owner's session on the channel of the first store. */
  readonly onStore: Caller;
}

/** Everything about one account that another account's actions must leave alone. */
export interface AccountSnapshot {
  readonly user: unknown;
  readonly administrator: unknown;
  readonly methods: unknown;
  readonly tokens: unknown;
  readonly sessions: number;
  readonly mails: number;
  readonly businessAssets: number;
}

/** How long a mail that should not exist is given to arrive. */
export const QUIET_PERIOD_MS = 1500;

export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, QUIET_PERIOD_MS));

async function side(kit: AccountFlowKit, business: BusinessFixture): Promise<Side> {
  const { email, password } = business.owner;
  const [row] = await kit.sql<{ id: number }>('SELECT "id" FROM "user" WHERE "identifier" = $1', [email]);
  const session = await kit.session(email, password);
  const [store] = business.stores;
  return {
    business,
    email,
    password,
    userId: row?.id ?? 0,
    session,
    onStore: { ...session, channelToken: store.channelToken },
  };
}

/** Provisions businesses A and B through the Admin API and signs both owners in. */
export async function startTwoBusinesses(kit: AccountFlowKit): Promise<{ a: Side; b: Side }> {
  const { a, b } = await createTwoBusinesses(kit.adminClient);
  return { a: await side(kit, a), b: await side(kit, b) };
}

/** Reads the rows of an account straight from the database, so a change cannot hide behind an API. */
export async function snapshotOf(kit: AccountFlowKit, account: Side): Promise<AccountSnapshot> {
  const { userId, email, business } = account;
  const one = async (query: string, parameters: unknown[]): Promise<unknown> =>
    (await kit.sql<{ row: unknown }>(query, parameters))[0]?.row;
  return {
    user: await one(
      'SELECT json_build_object(\'identifier\', "identifier", \'verified\', "verified", \'deletedAt\', "deletedAt") AS row FROM "user" WHERE "id" = $1',
      [userId],
    ),
    administrator: await one('SELECT row_to_json(a) AS row FROM "administrator" a WHERE a."userId" = $1', [userId]),
    methods: (
      await kit.sql<{ row: unknown }>(
        'SELECT row_to_json(m) AS row FROM "authentication_method" m WHERE m."userId" = $1 ORDER BY m."id"',
        [userId],
      )
    ).map((entry) => entry.row),
    tokens: (
      await kit.sql<{ row: unknown }>(
        'SELECT row_to_json(t) AS row FROM "account_token" t WHERE t."userId" = $1 ORDER BY t."id"',
        [userId],
      )
    ).map((entry) => entry.row),
    sessions: Number(
      (await kit.sql<{ count: string }>('SELECT count(*) AS count FROM "session" WHERE "userId" = $1', [userId]))[0]
        ?.count,
    ),
    mails: (await messagesTo(email)).length,
    businessAssets: Number(
      (
        await kit.sql<{ count: string }>(
          `SELECT count(*) AS count FROM "asset_channels_channel" ac JOIN "channel" c ON c."id" = ac."channelId"
           WHERE c."token" = ANY($1)`,
          [business.stores.map((store) => store.channelToken)],
        )
      )[0]?.count,
    ),
  };
}

/** The identifiers of `account` that no response to another account may contain. */
export function identifiersOf({ business, email }: Side): string[] {
  const stores = business.stores.flatMap((store) => [store.id, store.channelToken, store.subdomain]);
  return [email, business.businessId, ...stores];
}

/** The identifiers of `account` found in `value`. */
export function leaksOf(value: unknown, account: Side): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return identifiersOf(account).filter((identifier) => text.includes(identifier));
}

/** What the tests of one file share: a pair per test, and the checks every attack on B ends with. */
export interface PairHarness {
  /** Call inside a `describe`: each test of the group gets a pair of its own, handed to `onPair`. */
  readonly withFreshPair: (onPair: (pair: { a: Side; b: Side }) => void) => void;
  /** Runs `attack` and proves it left `victim` exactly as it was, down to the rows and the mailbox. */
  readonly leavesUntouched: (victim: Side, attack: () => Promise<void>) => Promise<void>;
  /** Gives `owner` an open verification link and code, and returns both. */
  readonly openVerificationOf: (owner: Side) => Promise<{ token: string; code: string }>;
  readonly loginCode: (side: Side, password?: string) => Promise<string>;
}

/** Builds the {@link PairHarness} of a test file on its server kit. */
export function createPairHarness(kit: AccountFlowKit): PairHarness {
  return {
    withFreshPair: (onPair) => {
      beforeEach(async () => {
        onPair(await startTwoBusinesses(kit));
      });
    },
    leavesUntouched: async (victim, attack) => {
      const before = await snapshotOf(kit, victim);
      await attack();
      await settle();
      expect(await snapshotOf(kit, victim)).toEqual(before);
    },
    openVerificationOf: async (owner) => {
      await kit.client.graphql(RESEND, {}, owner.session);
      return { token: await kit.tokenInMail(owner.email), code: await kit.codeInMail(owner.email) };
    },
    loginCode: async (side, password = side.password) =>
      (await kit.client.login(side.email, password, { ip: uniqueIp() })).code,
  };
}
