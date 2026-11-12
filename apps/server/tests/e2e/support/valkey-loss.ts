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

/**
 * Polls `read` until it returns a value. After `timeoutMs` it fails with what `describe` reports (the state actually
 * reached), so a real defect shows its rows instead of a bare timeout.
 */
export async function until<T>(
  read: () => Promise<T | undefined>,
  timeoutMs = DRAIN_TIMEOUT_MS,
  describe: () => Promise<string> = () => Promise.resolve(''),
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`the condition did not hold in time ${await describe()}`.trim());
    await sleep(POLL_MS);
  }
}

/**
 * The rows still open across the whole chain, read in ONE statement so they come from one snapshot. Read one table at a
 * time, an event relayed between the reads would hide its new `pending` deliveries: the delivery count was taken before
 * they existed and the event count after it stopped being `pending`.
 */
export const SETTLED_SQL = `SELECT
    (SELECT count(*)::int FROM "outbox_delivery" WHERE "status" <> 'done') AS "openDeliveries",
    (SELECT count(*)::int FROM "outbox_delivery") AS "deliveries",
    (SELECT count(*)::int FROM "inbound_webhook" WHERE "status" <> 'processed') AS "openWebhooks",
    (SELECT count(*)::int FROM "inbound_webhook") AS "webhooks",
    (SELECT count(*)::int FROM "outbox_event" WHERE "status" = 'pending') AS "pendingEvents"`;

/** Each delivery's and webhook's status, for the timeout message of the settled wait. */
export const STATUS_REPORT_SQL = `SELECT 'delivery' AS "kind", "outboxId"::text || ':' || "consumer" AS "key", "status", "attempts"
    FROM "outbox_delivery" WHERE "status" <> 'done'
  UNION ALL SELECT 'webhook', "id"::text, "status", NULL FROM "inbound_webhook" WHERE "status" <> 'processed'
  UNION ALL SELECT 'event', "id"::text, "status", NULL FROM "outbox_event" WHERE "status" = 'pending'`;
