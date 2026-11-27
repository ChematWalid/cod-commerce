export { type GaugeReading, PlatformGaugesService } from './application/platform-gauges.service';
export type { PlatformGaugeSources } from './application/ports';
export { METER_NAME, METRIC_NAMES, type MetricName } from './domain/constants';
// Outside Vendure (the evidence producer, scripts/evidence/P3.S5a-otel-producer.ts) the gauges run without the plugin.
export { snapshotOfQueue } from './infrastructure/bullmq-queue-snapshot';
export { OtelGaugeExporter } from './infrastructure/otel-gauge-exporter';
export { PlatformMetricsPlugin } from './platform-metrics.plugin';
