// The evidence producer of P3.S5a-otel.sh: runs inside a container on the evidence project's network, with the server's
// observability preload (`-r ./src/config/otel.ts`) started against the compose collector. It puts synthetic jobs in two
// pool queues of the evidence Valkey, publishes the platform gauges once through the real exporter, flushes, and cleans
// the queues. The outbox and the heartbeats are synthetic (this stack has no schema); the queue gauges read BullMQ.
import { OtelGaugeExporter, PlatformGaugesService, snapshotOfQueue } from '@cod/plugin-platform-metrics';
import { metrics } from '@opentelemetry/api';
import type { MeterProvider } from '@opentelemetry/sdk-metrics';
import { QUEUE_NAME } from '@vendure/job-queue-plugin/package/bullmq/constants';
import { Queue } from 'bullmq';

const SECOND = 1000;
const redisUrl = new URL(process.env['EVIDENCE_REDIS_URL'] ?? 'redis://valkey:6379');
const connection = { host: redisUrl.hostname, port: Number(redisUrl.port) };
const queueOf = (pool: 'critical' | 'bulk') => new Queue(QUEUE_NAME, { prefix: `bull:evidence:${pool}`, connection });

async function main(): Promise<void> {
  const critical = queueOf('critical');
  const bulk = queueOf('bulk');
  await critical.addBulk([
    { name: 'dispatch', data: { synthetic: true } },
    { name: 'dispatch', data: { synthetic: true } },
    { name: 'notifications', data: { synthetic: true } },
  ]);
  await bulk.add('capi', { synthetic: true }, { delay: 600 * SECOND });
  const now = Date.now();
  const gauges = new PlatformGaugesService({
    queues: { snapshotOf: (pool) => snapshotOfQueue(pool === 'critical' ? critical : bulk) },
    pools: ['critical', 'bulk'],
    outbox: { pendingSummary: () => Promise.resolve({ pending: 3, oldest: new Date(now - 42 * SECOND) }) },
    tasks: {
      lastSuccess: () => Promise.resolve(new Map([['outbox-sweeper', new Date(now - 61 * SECOND)]])),
      scheduledTaskIds: () => ['outbox-sweeper', 'job-reconciler'],
    },
    now: () => Date.now(),
    logger: { error: (message) => console.error(message) },
  });
  const exporter = new OtelGaugeExporter(gauges);
  exporter.start();
  await (metrics.getMeterProvider() as unknown as MeterProvider).forceFlush();
  exporter.stop();
  await Promise.all([critical.obliterate({ force: true }), bulk.obliterate({ force: true })]);
  await Promise.all([critical.close(), bulk.close()]);
  console.log('evidence producer: gauges exported');
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
