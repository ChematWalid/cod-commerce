import type { PartitionPolicy, PartitionRef } from '@cod/plugin-platform-partitions';
import {
  OUTBOX_DELIVERY_TABLE,
  OUTBOX_EVENT_TABLE,
  OUTBOX_PREMAKE_DAYS,
  OUTBOX_RETAIN_DAYS,
} from '../domain/constants';

/** The one thing the policies need of the database: a read. */
export interface SqlReader {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/** A partition name is made by the calendar from a table and a date, so it is safe as an identifier; check anyway. */
const SAFE_IDENTIFIER = /^[a-z_]+_p[0-9]{6,8}$/;

async function existsIn(reader: SqlReader, partition: string, condition: string): Promise<boolean> {
  if (!SAFE_IDENTIFIER.test(partition)) throw new Error(`Unexpected partition name "${partition}"`);
  const rows = (await reader.query(`SELECT EXISTS (SELECT 1 FROM "${partition}" WHERE ${condition}) AS found`)) as {
    found: boolean;
  }[];
  return rows[0]?.found === true;
}

async function partitionExists(reader: SqlReader, name: string): Promise<boolean> {
  const rows = (await reader.query('SELECT to_regclass($1) AS found', [name])) as { found: string | null }[];
  return rows[0]?.found !== null && rows[0]?.found !== undefined;
}

/**
 * The retention policies of the two tables (D107). A cross-tenant read per partition: it names no business and
 * returns no row, only whether one is still open. Seven days kept; a delivery partition is dropped only when no
 * delivery in it is open, an event partition only when none of its events is `pending` and its delivery partition is
 * gone. Otherwise the partition is kept and maintenance logs an error, which is the dead-letter alert.
 */
export function outboxPartitionPolicies(connection: { readonly rawConnection: SqlReader }): readonly PartitionPolicy[] {
  const reader = connection.rawConnection;
  const deliveryName = (event: PartitionRef): string => event.name.replace(OUTBOX_EVENT_TABLE, OUTBOX_DELIVERY_TABLE);
  const common = {
    column: 'createdAt',
    interval: 'day',
    premake: OUTBOX_PREMAKE_DAYS,
    retain: OUTBOX_RETAIN_DAYS,
  } as const;
  return [
    {
      ...common,
      table: OUTBOX_DELIVERY_TABLE,
      keepIf: async (partition) =>
        (await existsIn(reader, partition.name, `"status" IN ('pending', 'enqueued')`))
          ? 'the partition still holds deliveries that are not over'
          : null,
    },
    {
      ...common,
      table: OUTBOX_EVENT_TABLE,
      keepIf: async (partition) => {
        if (await existsIn(reader, partition.name, `"status" = 'pending'`))
          return 'the partition still holds pending events';
        if (await partitionExists(reader, deliveryName(partition)))
          return 'the delivery partition of the same day still exists';
        return null;
      },
    },
  ];
}
