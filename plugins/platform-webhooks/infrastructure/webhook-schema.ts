import type { PartitionedTableSchema } from '@cod/shared';
import { INBOUND_WEBHOOK_TABLE } from '../domain/constants';

/**
 * `inbound_webhook`, range-partitioned by UTC day on `receivedAt` with the key in the primary key (D106). The
 * migration `platform-webhooks` holds a literal copy of this SQL; the schema check of Task 18 compares them.
 * `inbound_webhook_key` is a plain table and comes from its entity.
 */
export const INBOUND_WEBHOOK_SCHEMAS: readonly PartitionedTableSchema[] = [
  {
    table: INBOUND_WEBHOOK_TABLE,
    column: 'receivedAt',
    createSql: `CREATE TABLE "inbound_webhook" (
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
  ) PARTITION BY RANGE ("receivedAt");
  CREATE INDEX "IDX_inbound_webhook_received" ON "inbound_webhook" ("receivedAt") WHERE "status" = 'received'`,
  },
];
