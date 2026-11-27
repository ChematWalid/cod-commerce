import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getSdkConfiguration } from '@vendure/telemetry-plugin/preload';
import type { TelemetrySettings } from '../telemetry-env';

/** How often the metric reader collects the gauges and exports them (ADR 0015 dashboards read 1 min points). */
export const METRIC_EXPORT_INTERVAL_MS = 60_000;

/** The `service.namespace` of every role; `service.name` is `cod-<role>`. */
export const SERVICE_NAMESPACE = 'cod';

/** The resource every span, log and metric of this process carries. No host name: it would add a label per node. */
export function resourceAttributesOf(settings: TelemetrySettings): Record<string, string> {
  return {
    'service.name': `${SERVICE_NAMESPACE}-${settings.role}`,
    'service.namespace': SERVICE_NAMESPACE,
    'deployment.environment.name': settings.appEnv,
  };
}

/**
 * Starts the OpenTelemetry Node SDK with Vendure's instrumentations (`@vendure/telemetry-plugin`, ADR 0015):
 * traces and logs over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (the SDK's exporters read it), plus a metric
 * reader for the platform gauges and the runtime metrics. The collector scrubs and samples before anything leaves
 * the node.
 */
export function startOpenTelemetry(settings: TelemetrySettings): NodeSDK {
  const sdk = new NodeSDK(
    getSdkConfiguration({
      config: {
        resource: resourceFromAttributes(resourceAttributesOf(settings)),
        metricReaders: [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
          }),
        ],
      },
    }),
  );
  sdk.start();
  return sdk;
}
