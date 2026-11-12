import type { MigrationInterface, QueryRunner } from 'typeorm';

const MONTHS_AHEAD = 3;
const COLUMNS = `"businessId", "storeId", "id", "actorAdministratorId", "action", "entityType", "entityId", "summary", "diff", "ip", "userAgent", "createdAt"`;

/** The first day (UTC) of the month `count` months after the month of `at`. */
const monthStart = (at: Date, count: number): Date =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + count, 1));

const partitionName = (start: Date): string =>
  `activity_log_p${String(start.getUTCFullYear())}${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

/**
 * D123 (audit RBAC-2): `activity_log` becomes a table partitioned by month on `createdAt`, primary key
 * `(createdAt, id)`, append-only by a row trigger. Rows are copied, so every existing row lands in the partition of
 * its month; the partitions cover the oldest row through the current month plus three.
 */
export class ActivityLogPartitioned1794426900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "activity_log_unpartitioned"`);
    for (const index of [
      'IDX_2fde88f5a72890faa80b562b63',
      'IDX_d7928002392420b34a7ce2c036',
      'IDX_d347e02f331af18250c1233cf5',
      'IDX_0b24949b8eaf781c929ae2a59e',
    ]) {
      await queryRunner.query(`DROP INDEX "${index}"`);
    }
    await queryRunner.query(`CREATE TABLE "activity_log" (
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
  ) PARTITION BY RANGE ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_0b24949b8eaf781c929ae2a59e" ON "activity_log" ("businessId", "id")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_d347e02f331af18250c1233cf5" ON "activity_log" ("businessId", "actorAdministratorId", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7928002392420b34a7ce2c036" ON "activity_log" ("businessId", "action", "id")`,
    );
    await queryRunner.query(`CREATE FUNCTION activity_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'activity_log is append-only';
  END;
  $$`);
    await this.createPartitions(queryRunner);
    await queryRunner.query(
      `INSERT INTO "activity_log" (${COLUMNS}) SELECT ${COLUMNS} FROM "activity_log_unpartitioned"`,
    );
    await queryRunner.query(`DROP TABLE "activity_log_unpartitioned"`);
    // After the copy: the trigger refuses row updates and deletes only, never the inserts above.
    await queryRunner.query(`CREATE TRIGGER "activity_log_append_only" BEFORE UPDATE OR DELETE ON "activity_log"
    FOR EACH ROW EXECUTE FUNCTION activity_log_append_only()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "activity_log_partitioned"`);
    await queryRunner.query(`DROP TRIGGER "activity_log_append_only" ON "activity_log_partitioned"`);
    for (const index of ['IDX_d7928002392420b34a7ce2c036', 'IDX_d347e02f331af18250c1233cf5', 'IDX_0b24949b8eaf781c929ae2a59e']) {
      await queryRunner.query(`DROP INDEX "${index}"`);
    }
    await queryRunner.query(`CREATE TABLE "activity_log" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "actorAdministratorId" integer, "action" character varying(64) NOT NULL, "entityType" character varying(32) NOT NULL, "entityId" character varying(32) NOT NULL, "summary" character varying(255) NOT NULL, "diff" jsonb NOT NULL, "ip" character varying(64), "userAgent" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_067d761e2956b77b14e534fd6f1" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_2fde88f5a72890faa80b562b63" ON "activity_log" ("businessId")`);
    await queryRunner.query(`CREATE INDEX "IDX_d7928002392420b34a7ce2c036" ON "activity_log" ("businessId", "action", "id")`);
    await queryRunner.query(`CREATE INDEX "IDX_d347e02f331af18250c1233cf5" ON "activity_log" ("businessId", "actorAdministratorId", "id")`);
    await queryRunner.query(`CREATE INDEX "IDX_0b24949b8eaf781c929ae2a59e" ON "activity_log" ("businessId", "id")`);
    await queryRunner.query(
      `INSERT INTO "activity_log" (${COLUMNS}) SELECT ${COLUMNS} FROM "activity_log_partitioned"`,
    );
    await queryRunner.query(`DROP TABLE "activity_log_partitioned"`);
    await queryRunner.query(`DROP FUNCTION activity_log_append_only()`);
  }

  /** One partition per month from the oldest row (or this month) through three months past the newest. */
  private async createPartitions(queryRunner: QueryRunner): Promise<void> {
    const bounds = (await queryRunner.query(
      `SELECT min("createdAt") AS oldest, max("createdAt") AS newest FROM "activity_log_unpartitioned"`,
    )) as { oldest: Date | null; newest: Date | null }[];
    const now = new Date();
    const oldest = bounds[0]?.oldest ?? now;
    const newest = bounds[0]?.newest ?? now;
    const last = monthStart(newest.getTime() > now.getTime() ? newest : now, MONTHS_AHEAD);
    for (let start = monthStart(oldest, 0); start.getTime() <= last.getTime(); start = monthStart(start, 1)) {
      const end = monthStart(start, 1);
      await queryRunner.query(
        `CREATE TABLE "${partitionName(start)}" PARTITION OF "activity_log" FOR VALUES FROM ('${start.toISOString()}') TO ('${end.toISOString()}')`,
      );
    }
  }
}
