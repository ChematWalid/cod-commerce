/**
 * The metrics the ops dashboards and alert rules (`ops/grafana`, `ops/alerts`) may reference, and the two
 * translations the cross-check needs: OTLP name → Prometheus series (what Grafana Cloud's OTLP gateway stores) and
 * PromQL expression → the metric names it reads.
 */

/** How an OTLP instrument maps onto Prometheus: counters get `_total`, histograms three series. */
export type OtlpKind = 'gauge' | 'counter' | 'updown' | 'histogram';

/** Where an emitted metric comes from, so the test can prove it exists. */
export type MetricSource = 'instrumentation-http' | 'runtime-node' | 'redis' | 'postgresql' | 'httpcheck';

/** One OTLP metric as its producer declares it. */
export interface OtlpMetric {
  readonly name: string;
  readonly unit: string;
  readonly kind: OtlpKind;
}

/** A metric emitted by a library or a collector receiver rather than by our own gauges. */
export interface ExternalMetric extends OtlpMetric {
  readonly source: MetricSource;
}

/**
 * The library and receiver metrics the dashboards read, with the unit and kind their producer declares
 * (`@opentelemetry/instrumentation-http` and `-runtime-node` through `@vendure/telemetry-plugin`; the redis,
 * postgresql and httpcheck receivers of `otel/collector.yaml`, collector-contrib 0.135 metadata).
 */
export const EXTERNAL_METRICS: readonly ExternalMetric[] = [
  { source: 'instrumentation-http', name: 'http.server.request.duration', unit: 's', kind: 'histogram' },
  { source: 'runtime-node', name: 'nodejs.eventloop.delay.p99', unit: 's', kind: 'gauge' },
  { source: 'runtime-node', name: 'v8js.memory.heap.used', unit: 'By', kind: 'gauge' },
  { source: 'redis', name: 'redis.memory.used', unit: 'By', kind: 'gauge' },
  { source: 'redis', name: 'redis.maxmemory', unit: 'By', kind: 'gauge' },
  { source: 'redis', name: 'redis.clients.connected', unit: '{client}', kind: 'updown' },
  { source: 'redis', name: 'redis.keyspace.hits', unit: '{hit}', kind: 'counter' },
  { source: 'redis', name: 'redis.keyspace.misses', unit: '{miss}', kind: 'counter' },
  { source: 'redis', name: 'redis.keys.evicted', unit: '{key}', kind: 'counter' },
  { source: 'postgresql', name: 'postgresql.backends', unit: '1', kind: 'updown' },
  { source: 'postgresql', name: 'postgresql.connection.max', unit: '{connections}', kind: 'gauge' },
  { source: 'postgresql', name: 'postgresql.commits', unit: '1', kind: 'counter' },
  { source: 'postgresql', name: 'postgresql.rollbacks', unit: '1', kind: 'counter' },
  { source: 'postgresql', name: 'postgresql.db_size', unit: 'By', kind: 'updown' },
  { source: 'httpcheck', name: 'httpcheck.status', unit: '1', kind: 'updown' },
  { source: 'httpcheck', name: 'httpcheck.error', unit: '{error}', kind: 'updown' },
];

/** OTLP units the Prometheus translation spells out; `{…}` annotations are dropped. */
const UNIT_WORDS: Readonly<Record<string, string>> = { s: 'seconds', ms: 'milliseconds', By: 'bytes' };

const unitSuffixOf = (metric: OtlpMetric): string => {
  if (metric.unit === '1') return metric.kind === 'gauge' ? 'ratio' : '';
  return UNIT_WORDS[metric.unit] ?? '';
};

/**
 * The Prometheus name of an OTLP metric, as the OTLP → Prometheus translation with suffixes builds it: invalid
 * characters become `_`, the unit word is appended unless the name already has it, and a monotonic counter ends
 * in `_total`.
 */
export function prometheusNameOf(metric: OtlpMetric): string {
  const tokens = metric.name.split(/[^a-zA-Z0-9:]+/).filter((token) => token !== '' && token !== 'total');
  const unit = unitSuffixOf(metric);
  if (unit !== '' && !tokens.includes(unit)) tokens.push(unit);
  if (metric.kind === 'counter') tokens.push('total');
  return tokens.join('_');
}

/** Every Prometheus series name an OTLP metric produces (a histogram's `_bucket`, `_count` and `_sum`). */
export function prometheusSeriesOf(metric: OtlpMetric): string[] {
  const name = prometheusNameOf(metric);
  return metric.kind === 'histogram' ? [`${name}_bucket`, `${name}_count`, `${name}_sum`] : [name];
}

/** PromQL words that look like a metric name but are operators or modifiers. */
const PROMQL_KEYWORDS = new Set([
  'and',
  'or',
  'unless',
  'bool',
  'offset',
  'by',
  'without',
  'on',
  'ignoring',
  'group_left',
  'group_right',
]);

/**
 * The metric names a PromQL expression reads: label matchers, strings, ranges, grouping clauses, Grafana
 * variables and function calls are removed first, so what is left of each identifier is a selector.
 */
export function metricNamesIn(expression: string): string[] {
  const bare = expression
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(?:by|without|on|ignoring|group_left|group_right)\s*\([^)]*\)/g, ' ')
    .replace(/\$\{?\w+\}?/g, ' ');
  const names = [...bare.matchAll(/(?<![\w.])([A-Za-z_:][\w:]*)(\s*\()?/g)]
    .filter((match) => match[2] === undefined && !PROMQL_KEYWORDS.has(match[1] ?? ''))
    .map((match) => match[1] ?? '');
  return [...new Set(names)];
}
