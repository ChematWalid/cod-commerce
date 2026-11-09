import { TransactionalConnection } from '@vendure/core';
import type { Caller, GraphqlAnswer } from './login-test-client';
import { waitForMessages } from './mailpit';
import { createRegisterTestKit, inputFor, PASSWORD, type RegisterTestKit, uniqueIp } from './register-test-kit';

const ACCOUNT_STATUS = `query { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } }`;

/** A merchant who has just registered, with an open session. */
export interface TestOwner {
  readonly email: string;
  readonly session: Caller;
}

/** The registration kit plus what the verification, reset and change flow tests share. */
export interface AccountFlowKit extends RegisterTestKit {
  readonly owner: () => Promise<TestOwner>;
  readonly session: (email: string, password?: string, ip?: string) => Promise<Caller>;
  readonly tokenInMail: (address: string, count?: number) => Promise<string>;
  readonly codeInMail: (address: string, count?: number) => Promise<string>;
  readonly status: (caller: Caller) => Promise<Record<string, unknown>>;
  readonly ageTokens: (email: string, minutes: number) => Promise<void>;
  readonly sql: <T>(query: string, parameters?: unknown[]) => Promise<T[]>;
}

const mailBody = async (address: string, count: number): Promise<string> => {
  const messages = await waitForMessages(address, count);
  return messages[count - 1]?.Text ?? '';
};

/** Builds the {@link AccountFlowKit} of a test file. */
export function createAccountFlowKit(): AccountFlowKit {
  const kit = createRegisterTestKit();

  const sql = <T>(query: string, parameters: unknown[] = []): Promise<T[]> =>
    kit.server.app.get(TransactionalConnection).rawConnection.query<T[]>(query, parameters);

  async function session(email: string, password = PASSWORD, ip = uniqueIp()): Promise<Caller> {
    const { token, code } = await kit.client.login(email, password, { ip });
    if (token === null) {
      throw new Error(`login refused: ${code}`);
    }
    return { token };
  }

  async function owner(): Promise<TestOwner> {
    const input = inputFor();
    const email = input['email'] as string;
    const answer: GraphqlAnswer = await kit.register(input);
    if (answer.errors.length > 0) {
      throw new Error(`registration refused: ${answer.errors[0]?.message ?? ''}`);
    }
    return { email, session: await session(email) };
  }

  async function tokenInMail(address: string, count = 1): Promise<string> {
    return /token=([\w-]+)/.exec(await mailBody(address, count))?.[1] ?? '';
  }

  async function codeInMail(address: string, count = 1): Promise<string> {
    return /code=(\d{6})/.exec(await mailBody(address, count))?.[1] ?? '';
  }

  async function status(caller: Caller): Promise<Record<string, unknown>> {
    const answer = await kit.client.graphql(ACCOUNT_STATUS, {}, caller);
    return answer.data?.['accountStatus'] ?? {};
  }

  /** Moves the user's tokens into the past, which is how the real cooldown is waited out. */
  async function ageTokens(email: string, minutes: number): Promise<void> {
    await sql(
      `UPDATE "account_token" SET "createdAt" = "createdAt" - make_interval(mins => $2)
       WHERE "userId" = (SELECT "id" FROM "user" WHERE "identifier" = $1)`,
      [email, minutes],
    );
  }

  return { ...kit, owner, session, tokenInMail, codeInMail, status, ageTokens, sql };
}
