import type { PartitionedTableSchema } from '@cod/shared';

/** The fixture table every integration test of this plugin partitions. */
export const PROBE_TABLE = 'partition_probe';

/** `partition_probe`: a bigint id, a UTC timestamp to range on, and the partition key in the primary key. */
export const PROBE_SCHEMA: PartitionedTableSchema = {
  table: PROBE_TABLE,
  column: 'createdAt',
  createSql: `CREATE TABLE ${PROBE_TABLE} (
    id bigint NOT NULL,
    "createdAt" timestamptz NOT NULL,
    note text,
    PRIMARY KEY ("createdAt", id)
  ) PARTITION BY RANGE ("createdAt")`,
};
