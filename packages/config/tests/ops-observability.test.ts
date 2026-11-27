import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { EXTERNAL_METRICS, metricNamesIn, type OtlpMetric, prometheusNameOf, prometheusSeriesOf } from './ops-metrics';

const ROOT = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface AlertRule {
  readonly alert: string;
  readonly expr: string;
  readonly for?: string;
  readonly labels?: Record<string, string>;
  readonly annotations?: Record<string, string>;
}
interface RuleFile {
  readonly groups: { readonly name: string; readonly rules: AlertRule[] }[];
}
interface Target {
  readonly expr: string;
  readonly datasource?: { readonly uid?: string };
}
interface Panel {
  readonly title: string;
  readonly type: string;
  readonly targets?: Target[];
  readonly datasource?: { readonly uid?: string };
}
interface Dashboard {
  readonly uid: string;
  readonly title: string;
  readonly __inputs: { readonly name: string; readonly pluginId: string }[];
  readonly panels: Panel[];
}
interface CollectorConfig {
  readonly receivers: Record<string, { readonly metrics?: Record<string, { readonly enabled?: boolean }> }>;
  readonly service: { readonly pipelines: Record<string, { readonly receivers: string[] }> };
}

const DASHBOARD_DIR = 'ops/grafana/dashboards';
const DASHBOARD_FILES = ['is-buying-working.json', 'queues.json', 'data-tier.json'] as const;
const rules = (parse(read('ops/alerts/rules.yml')) as RuleFile).groups.flatMap((group) => group.rules);
const dashboards = DASHBOARD_FILES.map((file) => JSON.parse(read(`${DASHBOARD_DIR}/${file}`)) as Dashboard);
const collector = parse(read('otel/collector.yaml')) as CollectorConfig;
const metricsDump = read('docs/evidence/P3.S5a/otel/metrics-dump.md');

const PLATFORM_METRICS = 'plugins/platform-metrics';

/**
 * The gauges `plugins/platform-metrics` creates: each `METRIC_NAMES` entry and the unit its exporter declares for it.
 * Read from the sources, since only the plugin's entry point may be imported and it loads Vendure.
 */
function platformGauges(): OtlpMetric[] {
  const names = new Map(
    [...read(`${PLATFORM_METRICS}/domain/constants.ts`).matchAll(/^\s+(\w+): '([a-z_]+)',$/gm)].map(
      ([, key, name]) => [key, name] as const,
    ),
  );
  const specs = read(`${PLATFORM_METRICS}/infrastructure/otel-gauge-exporter.ts`).matchAll(
    /\[METRIC_NAMES\.(\w+)\]: \{ description: '[^']*', unit: '([^']+)' \}/g,
  );
  return [...specs].map(([, key, unit]) => ({
    name: names.get(key ?? '') ?? `unknown:${key ?? ''}`,
    unit: unit ?? '',
    kind: 'gauge',
  }));
}

const EMITTED = new Set([...platformGauges(), ...EXTERNAL_METRICS].flatMap(prometheusSeriesOf));
const expressions: { readonly where: string; readonly expr: string }[] = [
  ...rules.map((rule) => ({ where: `alert ${rule.alert}`, expr: rule.expr })),
  ...dashboards.flatMap((dashboard) =>
    dashboard.panels.flatMap((panel) =>
      (panel.targets ?? []).map((target) => ({ where: `${dashboard.uid} / ${panel.title}`, expr: target.expr })),
    ),
  ),
];

describe('the platform gauges read from plugins/platform-metrics', () => {
  it('finds a unit for every gauge name, and they match the live collector dump', () => {
    // Arrange
    const gauges = platformGauges();

    // Assert
    expect(gauges.length).toBe(7);
    for (const gauge of gauges) {
      expect(metricsDump, gauge.name).toContain(`-> Name: ${gauge.name}\n-> Unit: ${gauge.unit}\n`);
    }
  });
});

describe('OTLP → Prometheus metric names', () => {
  it.each([
    [{ name: 'outbox_pending', unit: '{event}', kind: 'gauge' }, 'outbox_pending'],
    [{ name: 'outbox_oldest_age_seconds', unit: 's', kind: 'gauge' }, 'outbox_oldest_age_seconds'],
    [{ name: 'redis.memory.used', unit: 'By', kind: 'gauge' }, 'redis_memory_used_bytes'],
    [{ name: 'redis.keyspace.hits', unit: '{hit}', kind: 'counter' }, 'redis_keyspace_hits_total'],
    [{ name: 'postgresql.commits', unit: '1', kind: 'counter' }, 'postgresql_commits_total'],
    [{ name: 'postgresql.backends', unit: '1', kind: 'updown' }, 'postgresql_backends'],
    [{ name: 'nodejs.eventloop.utilization', unit: '1', kind: 'gauge' }, 'nodejs_eventloop_utilization_ratio'],
  ] as const)('names %o as %s', (metric, expected) => {
    // Act / Assert
    expect(prometheusNameOf(metric)).toBe(expected);
  });

  it('gives a histogram its bucket, count and sum series', () => {
    // Act
    const series = prometheusSeriesOf({ name: 'http.server.request.duration', unit: 's', kind: 'histogram' });

    // Assert
    expect(series).toEqual([
      'http_server_request_duration_seconds_bucket',
      'http_server_request_duration_seconds_count',
      'http_server_request_duration_seconds_sum',
    ]);
  });
});

describe('metricNamesIn', () => {
  it('finds the selectors and skips functions, labels, ranges, groupings and variables', () => {
    // Arrange
    const expression =
      'histogram_quantile(0.95, sum by (le, job) (rate(a_bucket{job="cod/cod-api", x=~"5.."}[$__rate_interval])))' +
      ' / on (job) group_left b offset 5m > bool 1e3 and absent_over_time(c[10m])';

    // Act / Assert
    expect(metricNamesIn(expression).sort()).toEqual(['a_bucket', 'b', 'c']);
  });
});

describe('ops/alerts/rules.yml (ADR 0015, system-design §8)', () => {
  it.each([
    'ApiServerErrorRate',
    'ReadyzDown',
    'OutboxLag',
    'WebhookBacklog',
    'ValkeyMemoryHigh',
    'ValkeyMemoryCritical',
    'QueueOldestWaitingCritical',
    'QueueOldestWaitingBulk',
    'WorkerAbsent',
  ])('has the %s alert', (name) => {
    // Assert
    expect(rules.map((rule) => rule.alert)).toContain(name);
  });

  it.each(rules.map((rule) => [rule.alert, rule] as const))('gives %s a level and a summary', (_name, rule) => {
    // Assert
    expect(['page', 'notify']).toContain(rule.labels?.['severity']);
    expect(rule.annotations?.['summary']).toBeTruthy();
  });

  it('pages for Valkey above 80 % and only notifies at 60 % (cache writes off)', () => {
    // Arrange
    const byName = new Map(rules.map((rule) => [rule.alert, rule]));

    // Assert
    expect(byName.get('ValkeyMemoryHigh')?.expr).toMatch(/>\s*0\.6\b/);
    expect(byName.get('ValkeyMemoryHigh')?.labels?.['severity']).toBe('notify');
    expect(byName.get('ValkeyMemoryCritical')?.expr).toMatch(/>\s*0\.8\b/);
    expect(byName.get('ValkeyMemoryCritical')?.labels?.['severity']).toBe('page');
  });

  it('calls the worker absent after 10 minutes without its gauges', () => {
    // Arrange
    const worker = rules.find((rule) => rule.alert === 'WorkerAbsent');

    // Assert
    expect(worker?.expr).toContain('absent_over_time(');
    expect(worker?.expr).toContain('[10m]');
  });
});

describe('ops/grafana/dashboards', () => {
  it('holds exactly the three dashboards of ADR 0015 this session builds', () => {
    // Assert
    expect(readdirSync(join(ROOT, DASHBOARD_DIR)).sort()).toEqual([...DASHBOARD_FILES].sort());
  });

  it.each(dashboards.map((dashboard) => [dashboard.uid, dashboard] as const))(
    'imports %s with a chosen Prometheus data source and queries in every panel',
    (_uid, dashboard) => {
      // Assert
      expect(dashboard.__inputs).toEqual([expect.objectContaining({ name: 'DS_PROMETHEUS', pluginId: 'prometheus' })]);
      expect(dashboard.panels.length).toBeGreaterThan(0);
      for (const panel of dashboard.panels) {
        expect(panel.datasource?.uid, panel.title).toBe('${DS_PROMETHEUS}');
        expect(panel.targets?.length, panel.title).toBeGreaterThan(0);
      }
    },
  );

  it('gives every dashboard its own uid', () => {
    // Assert
    expect(new Set(dashboards.map((dashboard) => dashboard.uid)).size).toBe(dashboards.length);
  });
});

describe('every metric a dashboard or an alert reads is emitted', () => {
  it.each(expressions.map((entry) => [entry.where, entry.expr] as const))('%s', (_where, expr) => {
    // Act
    const missing = metricNamesIn(expr).filter((name) => !EMITTED.has(name));

    // Assert
    expect(metricNamesIn(expr).length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('reads redis and postgresql metrics the live collector run printed, or ones its config switches on', () => {
    // Arrange
    const receiverMetrics = EXTERNAL_METRICS.filter((m) => m.source === 'redis' || m.source === 'postgresql');
    const switchedOn = (name: string): boolean =>
      Object.values(collector.receivers).some((receiver) => receiver.metrics?.[name]?.enabled === true);

    // Assert
    for (const metric of receiverMetrics) {
      expect(metricsDump.includes(`Name: ${metric.name}\n`) || switchedOn(metric.name), metric.name).toBe(true);
    }
  });

  it('runs the receivers those metrics come from in the metrics pipeline', () => {
    // Arrange
    const receivers = collector.service.pipelines['metrics']?.receivers ?? [];
    const sources = new Set(EXTERNAL_METRICS.map((metric) => metric.source));

    // Assert
    for (const receiver of ['redis', 'postgresql', 'httpcheck'] as const) {
      expect(sources.has(receiver)).toBe(true);
      expect(
        receivers.some((name) => name === receiver || name.startsWith(`${receiver}/`)),
        receiver,
      ).toBe(true);
    }
  });
});
