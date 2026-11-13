import type { PartitionedTableSchema } from '@cod/shared';
import { OUTBOX_DELIVERY_TABLE, OUTBOX_EVENT_TABLE } from '../domain/constants';

/**
 * The two outbox tables, range-partitioned by UTC day on `createdAt` with the key in the primary key (D106). The
 * migration `platform-outbox` holds a literal copy of this SQL; the schema check of Task 18 compares them.
 * `outbox_delivery` carries `storeId` because every tenant entity does (`TenantEntity`).
 */
export const OUTBOX_SCHEMAS: readonly PartitionedTableSchema[] = [
  {
    table: OUTBOX_EVENT_TABLE,
    column: 'createdAt',
    createSql: `CREATE TABLE "outbox_event" (
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
  ) PARTITION BY RANGE ("createdAt");
  CREATE INDEX "IDX_outbox_event_pending" ON "outbox_event" ("createdAt") WHERE "status" = 'pending'`,
  },
  {
    table: OUTBOX_DELIVERY_TABLE,
    column: 'createdAt',
    createSql: `CREATE TABLE "outbox_delivery" (
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
  ) PARTITION BY RANGE ("createdAt");
  CREATE INDEX "IDX_outbox_delivery_open" ON "outbox_delivery" ("createdAt") WHERE "status" IN ('pending', 'enqueued')`,
  },
];
