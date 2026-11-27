/** The metrics a summary shows, in this order, when the run produced them. */
const SHOWN_METRICS = [
  'http_reqs',
  'http_req_failed',
  'checks',
  'http_req_duration',
  'server_errors',
  'intake_duration',
  'intake_unexpected',
  'iterations',
];

/** @param {number} value */
const fixed = (value) => value.toFixed(2);
/** @param {number} value */
const ms = (value) => `${value.toFixed(1)} ms`;

/** @param {{ type: string, values: Record<string, number> }} metric */
function valuesOf(metric) {
  const v = metric.values;
  if (metric.type === 'counter') return `count ${String(v.count)}, rate ${fixed(v.rate)}/s`;
  if (metric.type === 'rate') return `${fixed(v.rate * 100)} %`;
  if (metric.type === 'trend') {
    return ['med', 'p(95)', 'p(99)', 'max']
      .filter((stat) => v[stat] !== undefined)
      .map((stat) => `${stat} ${ms(v[stat])}`)
      .join(', ');
  }
  return Object.entries(v)
    .map(([stat, value]) => `${stat} ${fixed(value)}`)
    .join(', ');
}

/** @param {Record<string, { type: string, values: Record<string, number>, thresholds?: Record<string, { ok: boolean }> }>} metrics */
function thresholdRows(metrics) {
  return Object.entries(metrics).flatMap(([name, metric]) =>
    Object.entries(metric.thresholds ?? {}).map(
      ([expression, { ok }]) => `| ${name} | \`${expression}\` | ${ok ? 'passed' : 'FAILED'} |`,
    ),
  );
}

/** @param {{ pending?: boolean, probeStatus?: number } | undefined} setup */
function pendingNote(setup) {
  if (setup?.pending !== true) return [];
  return [
    `**PENDING:** the intake route answered ${String(setup.probeStatus)}; order intake lands with P3.S4, so no ` +
      'submit was sent and the intake thresholds saw no sample.',
    '',
  ];
}

/**
 * A k6 end-of-test summary as markdown: the shown metrics, then every threshold with its verdict.
 *
 * @param {string} title
 * @param {{ setup_data?: { pending?: boolean, probeStatus?: number }, metrics: Record<string, any> }} data the
 *   `handleSummary` argument
 * @returns {string}
 */
export function renderSummary(title, data) {
  const metrics = data.metrics;
  const shown = SHOWN_METRICS.filter((name) => metrics[name] !== undefined);
  const thresholds = thresholdRows(metrics);
  return [
    `# ${title}`,
    '',
    ...pendingNote(data.setup_data),
    '| Metric | Values |',
    '|---|---|',
    ...shown.map((name) => `| ${name} | ${valuesOf(metrics[name])} |`),
    '',
    '| Threshold | Expression | Verdict |',
    '|---|---|---|',
    ...(thresholds.length > 0 ? thresholds : ['| (none) | | |']),
    '',
  ].join('\n');
}

/**
 * What `handleSummary` returns: the markdown on stdout, plus `<dir>/<name>.md` and `<dir>/<name>.json` when a
 * directory is given (the evidence run sets `SUMMARY_DIR`).
 *
 * @param {string} name file base name
 * @param {string} title
 * @param {{ metrics: Record<string, any> }} data the `handleSummary` argument
 * @param {string | undefined} dir
 * @returns {Record<string, string>}
 */
export function summaryFiles(name, title, data, dir) {
  const markdown = renderSummary(title, data);
  if (dir === undefined || dir === '') return { stdout: markdown };
  return {
    stdout: markdown,
    [`${dir}/${name}.md`]: markdown,
    [`${dir}/${name}.json`]: `${JSON.stringify(data, null, 2)}\n`,
  };
}
