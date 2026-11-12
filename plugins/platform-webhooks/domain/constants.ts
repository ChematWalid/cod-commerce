/** The largest request body the guard reads (D112); a bigger one is answered with 413. */
export const INTERNAL_BODY_LIMIT_BYTES = 102_400;

/** The logger context of the guard. */
export const INTERNAL_GUARD_LOG_CONTEXT = 'InternalOnlyGuard';

/** The URL prefix of the inbound gateway (D109). */
export const WEBHOOK_ROUTE_PREFIX = '/webhooks';

/** The most bytes a webhook body may have after decompression (D109); one more answers 413. */
export const WEBHOOK_BODY_LIMIT_BYTES = 262_144;

/** Seconds a sender is told to wait while the gateway is switched off. */
export const WEBHOOK_RETRY_AFTER_SECONDS = 60;

/** The operational flag that switches the gateway off (D116). */
export const INBOUND_WEBHOOKS_FLAG = 'inbound-webhooks.enabled';

/** The job queue that processes stored webhooks (D101). */
export const INBOUND_WEBHOOKS_QUEUE = 'inbound-webhooks' as const;

/** The Vendure log context of the gateway. */
export const WEBHOOKS_LOG_CONTEXT = 'InboundWebhooks';

/** The tables of the gateway (D106, D108). */
export const INBOUND_WEBHOOK_TABLE = 'inbound_webhook';
export const INBOUND_WEBHOOK_KEY_TABLE = 'inbound_webhook_key';

/** Days of partitions made ahead of the current one, kept behind it, and before the payload is cleared (D107). */
export const INBOUND_PREMAKE_DAYS = 7;
export const INBOUND_RETAIN_DAYS = 90;
export const INBOUND_SCRUB_AFTER_DAYS = 14;

/** Column limits. */
export const EVENT_KEY_MAX_LENGTH = 128;
export const CONTENT_TYPE_MAX_LENGTH = 100;
export const INBOUND_LAST_ERROR_MAX_LENGTH = 500;

const DAY_MS = 86_400_000;

/** A dedupe key is kept this long after it was first seen (D107). */
export const KEY_RETENTION_MS = 30 * DAY_MS;

/** Keys one purge batch deletes, and how long a run keeps taking batches (D107). */
export const KEY_PURGE_BATCH_SIZE = 5000;
export const KEY_PURGE_BUDGET_MS = 40_000;

/** The purge's scheduled task and its schedule (04:15 UTC daily). */
export const KEY_PURGE_TASK_ID = 'inbound-webhook-key-purge';
export const KEY_PURGE_SCHEDULE = '15 4 * * *';

/** The reconciler's name for the gateway's rows (D105). */
export const INBOUND_RECONCILE_SOURCE = 'inbound-webhook';

/** A received row is left to its job for this long before the reconciler looks at it. */
export const INBOUND_QUIET_MS = 60_000;

/** The reconciler looks no further back than this. */
export const INBOUND_RECONCILE_WINDOW_MS = 7 * DAY_MS;

/** What the reconciler writes to `lastError` of a row that used every attempt (D105). */
export const INBOUND_EXHAUSTED_ERROR = 'reconciler: attempts exhausted';

/** The demo provider (D110): the URL segment, the header of its signature and the optional header of its event id. */
export const DEMO_PROVIDER = 'demo';
export const DEMO_SIGNATURE_HEADER = 'x-demo-signature';
export const DEMO_EVENT_HEADER = 'x-demo-event-id';

/** Where the demo provider's signing secret lives in the tenant secret store. */
export const DEMO_SECRET_PROVIDER = 'demo-webhook';
export const DEMO_SECRET_REF = 'signing';

/** The demo consumer of the outbox topic the demo handler writes (D110). */
export const DEMO_CONSUMER = 'demo-log';
export const DEMO_TOPIC = 'platform.demo' as const;
export const DEMO_QUEUE = 'order-effects' as const;
