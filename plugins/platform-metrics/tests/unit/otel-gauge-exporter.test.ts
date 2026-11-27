import { MeterProvider, MetricReader, type ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { describe, expect, it } from 'vitest';
import type { GaugeReading } from '../../application/platform-gauges.service';
import { OtelGaugeExporter } from '../../infrastructure/otel-gauge-exporter';

/** A reader the test collects from by hand. */
class ManualReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const points = (metrics: ResourceMetrics) =>
  metrics.scopeMetrics.flatMap((scope) =>
    scope.metrics.flatMap((metric) =>
      metric.dataPoints.map((point) => ({
        name: metric.descriptor.name,
        value: point.value,
        attributes: point.attributes,
      })),
    ),
  );

const setUp = (readings: GaugeReading[]) => {
  const reader = new ManualReader();
  const provider = new MeterProvider({ readers: [reader] });
  let reads = 0;
  const exporter = new OtelGaugeExporter(
    {
      read: () => {
        reads += 1;
        return Promise.resolve(readings);
      },
    },
    provider.getMeter('test'),
  );
  return { reader, exporter, reads: () => reads };
};

describe('OtelGaugeExporter', () => {
  it('publishes each reading on its gauge with its labels when the reader collects', async () => {
    // Arrange
    const { reader, exporter } = setUp([
      { metric: 'outbox_pending', value: 4, attributes: {} },
      { metric: 'queue_jobs', value: 2, attributes: { pool: 'critical', queue: 'dispatch', state: 'waiting' } },
    ]);
    exporter.start();

    // Act
    const { resourceMetrics } = await reader.collect();

    // Assert
    expect(points(resourceMetrics)).toEqual(
      expect.arrayContaining([
        { name: 'outbox_pending', value: 4, attributes: {} },
        { name: 'queue_jobs', value: 2, attributes: { pool: 'critical', queue: 'dispatch', state: 'waiting' } },
      ]),
    );
  });

  it('reads the gauges once per collection and not before', async () => {
    // Arrange
    const { reader, exporter, reads } = setUp([]);
    exporter.start();
    exporter.start();

    // Act
    const before = reads();
    await reader.collect();

    // Assert
    expect(before).toBe(0);
    expect(reads()).toBe(1);
  });

  it('stops reading after stop', async () => {
    // Arrange
    const { reader, exporter, reads } = setUp([{ metric: 'outbox_pending', value: 1, attributes: {} }]);
    exporter.start();
    exporter.stop();

    // Act
    await reader.collect();

    // Assert
    expect(reads()).toBe(0);
  });
});
