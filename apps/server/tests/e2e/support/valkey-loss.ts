import gql from 'graphql-tag';

/** The Valkey database the valkey-loss-recovery suite owns and flushes (plan, Global Constraints). */
export const VALKEY_TEST_DATABASE = 13;
export const MINUTE_MS = 60_000;
const DRAIN_TIMEOUT_MS = 60_000;
const POLL_MS = 100;
/** A retry wait too long to elapse in a test, so a failed job stays delayed; and one short enough to exhaust attempts. */
export const LONG_BACKOFF_MS = 3_600_000;
export const SHORT_BACKOFF_MS = 50;

export const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

export const PROVISION_BUSINESS = gql`
  mutation ($input: ProvisionBusinessInput!) {
    provisionBusiness(input: $input) {
      business {
        id
      }
    }
  }
`;

/** The shell's `REDIS_URL` on the suite's own database. */
export function testRedisUrl(): string {
  const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
  url.pathname = `/${String(VALKEY_TEST_DATABASE)}`;
  return url.toString();
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `read` until it returns a value, failing after `timeoutMs`. */
export async function until<T>(read: () => Promise<T | undefined>, timeoutMs = DRAIN_TIMEOUT_MS): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('the condition did not hold in time');
    await sleep(POLL_MS);
  }
}
