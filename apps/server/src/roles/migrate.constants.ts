/**
 * The Postgres advisory lock key `migrate` holds while it migrates and seeds, so two `migrate` processes
 * started together (a rolling deploy, a retried job) run one after the other instead of racing on the same
 * DDL. Any fixed bigint works; this one spells "COD MIG" loosely and must stay the same across releases.
 */
export const MIGRATE_ADVISORY_LOCK_KEY = 7_202_613_400;

/** The `application_name` of the connection holding {@link MIGRATE_ADVISORY_LOCK_KEY}, for `pg_stat_activity`. */
export const MIGRATE_LOCK_APPLICATION_NAME = 'cod-migrate-lock';

/**
 * The migrations' connection gives up on a lock it cannot take after this long (SQLSTATE 55P03), so a DDL
 * statement never queues behind a busy table and blocks every query behind it (audit SRV-2, ADR 0016 §5, D122).
 */
export const MIGRATE_LOCK_TIMEOUT_MS = 5_000;

/** The longest one migration statement runs before Postgres cancels it (SQLSTATE 57014). A backfill sets its own. */
export const MIGRATE_STATEMENT_TIMEOUT_MS = 900_000;

/** How long a second `migrate` waits for {@link MIGRATE_ADVISORY_LOCK_KEY} before it fails (audit SRV-13). */
export const MIGRATE_LOCK_WAIT_MS = 600_000;

/** How often a waiting `migrate` retries `pg_try_advisory_lock`. */
export const MIGRATE_LOCK_POLL_MS = 1_000;
