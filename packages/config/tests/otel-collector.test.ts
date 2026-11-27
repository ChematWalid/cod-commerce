import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

interface Pipeline {
  readonly receivers: string[];
  readonly processors: string[];
  readonly exporters: string[];
}

interface CollectorConfig {
  readonly processors: Record<string, Record<string, unknown>>;
  readonly service: { readonly pipelines: Record<string, Pipeline> };
}

interface ComposeService {
  readonly image?: string;
  readonly profiles?: string[];
  readonly mem_limit?: string;
}

interface ComposeFile {
  readonly services: Record<string, ComposeService>;
  readonly configs: Record<string, { readonly content?: string }>;
}

const collectorSource = read('otel/collector.yaml');
const collector = parse(collectorSource) as CollectorConfig;
const compose = parse(read('docker-compose.yml'), { merge: true }) as ComposeFile;
const pipelines = Object.entries(collector.service.pipelines);

describe('otel/collector.yaml (ADR 0015)', () => {
  it.each(pipelines)('limits memory first and batches last in the %s pipeline', (_name, pipeline) => {
    // Assert
    expect(pipeline.processors[0]).toBe('memory_limiter');
    expect(pipeline.processors.at(-1)).toBe('batch');
    expect(pipeline.processors).toContain('transform/scrub');
  });

  it('deletes the query string, headers, client addresses and SQL literals of spans before export', () => {
    // Arrange
    const scrub = collector.processors['transform/scrub'] as { trace_statements: { statements: string[] }[] };
    const statements = scrub.trace_statements.flatMap((group) => group.statements);
    const has = (fragment: string): boolean => statements.some((statement) => statement.includes(fragment));

    // Assert
    expect(has('delete_key(span.attributes, "url.query")')).toBe(true);
    expect(has('replace_pattern(span.attributes["url.full"]')).toBe(true);
    expect(has('header')).toBe(true);
    expect(has('client\\\\.address')).toBe(true);
    expect(has('replace_pattern(span.attributes["db.statement"]')).toBe(true);
  });

  it('keeps errors and slow traces, samples 10 % of the rest and never keeps a visitor beacon', () => {
    // Arrange
    const policies = (collector.processors['tail_sampling'] as { policies: { type: string }[] }).policies;
    const sampling = JSON.stringify(policies);

    // Assert
    expect(collector.service.pipelines['traces']?.processors).toContain('tail_sampling');
    expect(policies[0]?.type).toBe('drop');
    expect(sampling).toContain('/api/store/visitors/(track|beacon)');
    expect(sampling).toContain('"status_codes":["ERROR"]');
    expect(sampling).toContain('"threshold_ms":1000');
    expect(sampling).toContain('"sampling_percentage":10');
  });

  it('exports only to the debug exporter: Grafana Cloud comes from the deployed overlay', () => {
    // Assert
    for (const [, pipeline] of pipelines) expect(pipeline.exporters).toEqual(['debug']);
    expect(read('otel/collector.grafana.yaml')).toContain('${env:GRAFANA_OTLP_AUTH}');
  });
});

describe('the compose collector', () => {
  it('runs a copy of otel/collector.yaml, with compose escaping only', () => {
    // Act
    const inline = compose.configs['otel_collector_yaml']?.content?.replaceAll('$$', '$');

    // Assert
    expect(inline?.trim()).toBe(collectorSource.trim());
  });

  it('uses the collector image tool.sh pins, in the ops profile, under its 150 MB limit', () => {
    // Arrange
    const pinned = spawnSync('bash', [join(repoRoot, 'scripts/ops/tool.sh'), 'image', 'otelcol'], {
      encoding: 'utf8',
    }).stdout.trim();
    const service = compose.services['otel-collector'];

    // Assert
    expect(service?.image).toBe(pinned);
    expect(service?.profiles).toEqual(['ops']);
    expect(service?.mem_limit).toBe('150m');
  });
});
