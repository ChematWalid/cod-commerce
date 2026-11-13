import type { PartitionPolicy } from '@cod/plugin-platform-partitions';
import {
  INBOUND_PREMAKE_DAYS,
  INBOUND_RETAIN_DAYS,
  INBOUND_SCRUB_AFTER_DAYS,
  INBOUND_WEBHOOK_TABLE,
} from '../domain/constants';

/**
 * Retention of `inbound_webhook` (D107): daily partitions, a week made ahead, the payload cleared after 14 days and
 * the partition dropped after 90. The scrub runs while the partition stays eligible, so it only touches rows that
 * still hold a payload.
 */
export const inboundWebhookPartitionPolicy: PartitionPolicy = {
  table: INBOUND_WEBHOOK_TABLE,
  column: 'receivedAt',
  interval: 'day',
  premake: INBOUND_PREMAKE_DAYS,
  retain: INBOUND_RETAIN_DAYS,
  scrub: {
    afterIntervals: INBOUND_SCRUB_AFTER_DAYS,
    sql: (partitionTable) => `UPDATE "${partitionTable}" SET "payload" = NULL WHERE "payload" IS NOT NULL`,
  },
};
