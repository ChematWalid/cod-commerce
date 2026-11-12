import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task 13 (D106-D109): the inbound webhook gateway. `inbound_webhook` is partitioned by day on `receivedAt`; the SQL
 * below is a literal copy of `INBOUND_WEBHOOK_SCHEMAS` (plugins/platform-webhooks), which the plugin tests apply with
 * `ensurePartitionedSchema`. Partitions come from the maintenance the migrate role runs after migrations.
 * `inbound_webhook_key` is a plain platform table: its primary key is the dedupe triple.
 */
export class PlatformWebhooks1794700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "inbound_webhook" (
    "businessId" bigint NOT NULL,
    "storeId" bigint,
    "id" bigint NOT NULL,
    "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "provider" character varying(40) NOT NULL,
    "accountId" character varying(64) NOT NULL,
    "eventKey" character varying(128) NOT NULL,
    "contentType" character varying(100) NOT NULL,
    "headers" jsonb NOT NULL,
    "payload" bytea,
    "status" character varying(16) NOT NULL DEFAULT 'received',
    "attempts" integer NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP WITH TIME ZONE,
    "lastError" character varying(500),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY ("receivedAt", "id")
  ) PARTITION BY RANGE ("receivedAt")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_webhook_received" ON "inbound_webhook" ("receivedAt") WHERE "status" = 'received'`,
    );
    await queryRunner.query(
      `CREATE TABLE "inbound_webhook_key" ("provider" character varying(40) NOT NULL, "accountId" character varying(64) NOT NULL, "eventKey" character varying(128) NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_e6bbfdbc9594d1634a4ffd4fdb7" PRIMARY KEY ("provider", "accountId", "eventKey"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_inbound_webhook_key_received" ON "inbound_webhook_key" ("receivedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inbound_webhook_key"`);
    await queryRunner.query(`DROP TABLE "inbound_webhook"`);
  }
}
