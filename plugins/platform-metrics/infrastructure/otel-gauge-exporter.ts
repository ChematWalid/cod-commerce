import {
  type BatchObservableCallback,
  type BatchObservableResult,
  type Meter,
  metrics,
  type ObservableGauge,
} from '@opentelemetry/api';
import type { GaugeReading, PlatformGaugesService } from '../application/platform-gauges.service';
import { METER_NAME, METRIC_NAMES, type MetricName } from '../domain/constants';

/** The description and unit of each gauge; `s` for ages, a curly-brace annotation for counts. */
const GAUGE_SPECS: Readonly<Record<MetricName, { readonly description: string; readonly unit: string }>> = {
  [METRIC_NAMES.outboxPending]: { description: 'Outbox events not yet relayed', unit: '{event}' },
  [METRIC_NAMES.outboxOldestAge]: { description: 'Age of the oldest pending outbox event', unit: 's' },
  [METRIC_NAMES.schedulerLastSuccessAge]: { description: 'Time since a scheduled task last succeeded', unit: 's' },
  [METRIC_NAMES.queuePoolJobs]: { description: 'Jobs of a worker pool by state', unit: '{job}' },
  [METRIC_NAMES.queueJobs]: { description: 'Jobs of a queue by state (sampled, oldest first)', unit: '{job}' },
  [METRIC_NAMES.queueOldestWaitingAge]: { description: 'Age of the oldest waiting job of a queue', unit: 's' },
  [METRIC_NAMES.intakeSpoolLength]: { description: 'Orders waiting in the intake spool', unit: '{order}' },
};

/**
 * Publishes the platform gauges on the OpenTelemetry meter. The values are read once per export of the SDK's
 * metric reader (60 s by default); without the SDK preload (`OTEL_EXPORTER_OTLP_ENDPOINT` unset) the global meter
 * is a no-op and nothing is ever read.
 */
export class OtelGaugeExporter {
  private registration: { readonly callback: BatchObservableCallback; readonly gauges: ObservableGauge[] } | null =
    null;

  constructor(
    private readonly gauges: Pick<PlatformGaugesService, 'read'>,
    private readonly meter: Meter = metrics.getMeter(METER_NAME),
  ) {}

  /** Creates the gauges and their batch callback; a second call does nothing. */
  start(): void {
    if (this.registration !== null) return;
    const instruments = new Map<MetricName, ObservableGauge>(
      Object.entries(GAUGE_SPECS).map(([name, spec]) => [
        name as MetricName,
        this.meter.createObservableGauge(name, spec),
      ]),
    );
    const callback: BatchObservableCallback = async (result: BatchObservableResult) => {
      for (const value of await this.gauges.read()) observe(result, instruments, value);
    };
    const gauges = [...instruments.values()];
    this.meter.addBatchObservableCallback(callback, gauges);
    this.registration = { callback, gauges };
  }

  /** Stops reading the gauges. */
  stop(): void {
    if (this.registration === null) return;
    this.meter.removeBatchObservableCallback(this.registration.callback, this.registration.gauges);
    this.registration = null;
  }
}

function observe(
  result: BatchObservableResult,
  instruments: Map<MetricName, ObservableGauge>,
  value: GaugeReading,
): void {
  const gauge = instruments.get(value.metric);
  if (gauge !== undefined) result.observe(gauge, value.value, value.attributes);
}
