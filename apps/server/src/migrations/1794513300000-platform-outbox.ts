import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task 6 (D104-D107): the transactional outbox. `outbox_event` and `outbox_delivery` are partitioned by day on
 * `createdAt`; the SQL below is a literal copy of `OUTBOX_SCHEMAS` (plugins/platform-outbox), which the plugin tests
 * apply with `ensurePartitionedSchema`. Partitions come from the maintenance the migrate role runs after migrations.
 */
export class PlatformOutbox1794513300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "outbox_event" (
    "businessId" bigint NOT NULL,
    "storeId" bigint,
    "id" bigint NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "topic" character varying(64) NOT NULL,
    "aggregateId" bigint,
    "payload" jsonb NOT NULL,
    "dedupeKey" character varying(200),
    "status" character varying(16) NOT NULL DEFAULT 'pending',
    "relayedAt" TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY ("createdAt", "id")
  ) PARTITION BY RANGE ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_outbox_event_pending" ON "outbox_event" ("createdAt") WHERE "status" = 'pending'`);
    await queryRunner.query(`CREATE TABLE "outbox_delivery" (
    "businessId" bigint NOT NULL,
    "storeId" bigint,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "outboxId" bigint NOT NULL,
    "consumer" character varying(40) NOT NULL,
    "status" character varying(16) NOT NULL,
    "attempts" integer NOT NULL DEFAULT 0,
    "enqueuedAt" TIMESTAMP WITH TIME ZONE,
    "nextAttemptAt" TIMESTAMP WITH TIME ZONE,
    "lastError" character varying(500),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY ("createdAt", "outboxId", "consumer")
  ) PARTITION BY RANGE ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_outbox_delivery_open" ON "outbox_delivery" ("createdAt") WHERE "status" IN ('pending', 'enqueued')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "outbox_delivery"`);
    await queryRunner.query(`DROP TABLE "outbox_event"`);
  }
}
