import type { PartitionedTableSchema } from '@cod/shared';

/** The partitioned table of the activity log (D123). */
export const ACTIVITY_LOG_TABLE = 'activity_log';

/** The trigger function and trigger that make the table append-only for row writes (D123, audit RBAC-2). */
export const ACTIVITY_LOG_APPEND_ONLY_FUNCTION = 'activity_log_append_only';

/**
 * `activity_log`, monthly range partitions on `createdAt` with the key in the primary key. The row trigger refuses
 * `UPDATE` and `DELETE`; `TRUNCATE` and partition `DROP` are not row operations, so retention and test resets work.
 * The migration `activity-log-partitioned` holds a literal copy of this SQL.
 */
export const ACTIVITY_LOG_SCHEMA: PartitionedTableSchema = {
  table: ACTIVITY_LOG_TABLE,
  column: 'createdAt',
  createSql: `CREATE TABLE "activity_log" (
    "businessId" bigint NOT NULL,
    "storeId" bigint,
    "id" bigint NOT NULL,
    "actorAdministratorId" integer,
    "action" character varying(64) NOT NULL,
    "entityType" character varying(32) NOT NULL,
    "entityId" character varying(32) NOT NULL,
    "summary" character varying(255) NOT NULL,
    "diff" jsonb NOT NULL,
    "ip" character varying(64),
    "userAgent" character varying(255),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY ("createdAt", "id")
  ) PARTITION BY RANGE ("createdAt");
  CREATE INDEX "IDX_0b24949b8eaf781c929ae2a59e" ON "activity_log" ("businessId", "id");
  CREATE INDEX "IDX_d347e02f331af18250c1233cf5" ON "activity_log" ("businessId", "actorAdministratorId", "id");
  CREATE INDEX "IDX_d7928002392420b34a7ce2c036" ON "activity_log" ("businessId", "action", "id");
  CREATE FUNCTION activity_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'activity_log is append-only';
  END;
  $$;
  CREATE TRIGGER "activity_log_append_only" BEFORE UPDATE OR DELETE ON "activity_log"
    FOR EACH ROW EXECUTE FUNCTION activity_log_append_only()`,
};
