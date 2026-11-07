/**
 * The Postgres advisory lock key `migrate` holds while it migrates and seeds, so two `migrate` processes
 * started together (a rolling deploy, a retried job) run one after the other instead of racing on the same
 * DDL. Any fixed bigint works; this one spells "COD MIG" loosely and must stay the same across releases.
 */
export const MIGRATE_ADVISORY_LOCK_KEY = 7_202_613_400;

/** The `application_name` of the connection holding {@link MIGRATE_ADVISORY_LOCK_KEY}, for `pg_stat_activity`. */
export const MIGRATE_LOCK_APPLICATION_NAME = 'cod-migrate-lock';
