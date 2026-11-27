// __ENV (the `-e NAME=value` options) and console are k6 runtime globals.
/* global __ENV, console */
import exec from 'k6/execution';
import { check, fail } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { cartQuoteBody, intakeBody, isIntakePending } from './lib/intake.js';
import { countServerError, getPage, productSlugsOf } from './lib/storefront.js';
import { summaryFiles } from './lib/summary.js';
import { storeTargetOf } from './lib/target.js';

/**
 * Flash sale (ADR 0009 addendum): one store, one hot product, a burst of parallel order submits. It records the
 * intake p95; lock waits come from Postgres during the run (`pg_stat_statements` / slow-query report). Every
 * submit creates a real order, so it runs only against a synthetic test store (`SYNTHETIC_STORE=1`).
 *
 * Pending until P3.S4: while `POST /api/store/orders` answers 404/405 the scenario sends no submit and the summary
 * says PENDING. The cart-quote and intake bodies follow the briefs and are checked when P3.S4 lands.
 *
 *   scripts/ops/tool.sh k6 run -e ORIGIN=… -e STORE_HOST=… -e SYNTHETIC_STORE=1 [-e PEAK=50] ops/k6/flash-sale.js
 */
if (__ENV.SYNTHETIC_STORE !== '1') {
  throw new Error('flash-sale creates real orders: set SYNTHETIC_STORE=1 only for a synthetic test store');
}

const target = storeTargetOf(__ENV);
const PEAK = Number(__ENV.PEAK ?? '50');
const HOLD = __ENV.HOLD ?? '20s';
const WILAYA = Number(__ENV.WILAYA ?? '16');
const ACCEPTED = [200, 201, 202];
const JSON_HEADERS = { Host: target.host, 'Content-Type': 'application/json' };

if (!(PEAK > 0)) throw new Error('PEAK must be a positive number');

const intakeDuration = new Trend('intake_duration', true);
const intakeUnexpected = new Counter('intake_unexpected');

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: PEAK,
      maxVUs: PEAK * 4,
      stages: [
        { target: PEAK, duration: '5s' },
        { target: PEAK, duration: HOLD },
        { target: 0, duration: '5s' },
      ],
    },
  },
  thresholds: {
    server_errors: ['count==0'],
    intake_unexpected: ['count==0'],
    intake_duration: ['p(95)<2000'],
  },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
};

/** @param {string} path @param {unknown} body @param {string} name */
function post(path, body, name) {
  const response = http.post(`${target.origin}${path}`, JSON.stringify(body), {
    headers: JSON_HEADERS,
    tags: { name },
  });
  countServerError(response, name);
  return response;
}

function hotVariantId() {
  const slug = __ENV.PRODUCT_SLUG ?? productSlugsOf(target, 1)[0];
  if (slug === undefined) fail(`the store ${target.host} lists no product: flash sale needs one`);
  const response = getPage(target, `/api/store/product/${encodeURIComponent(slug)}`, 'store api product');
  const product = /** @type {{ variants: Array<{ id: string }> }} */ (response.json());
  const variant = product.variants[0];
  if (variant === undefined) fail(`the product ${slug} has no visible variant`);
  return variant.id;
}

export function setup() {
  const probe = http.post(`${target.origin}/api/store/orders`, '{}', {
    headers: JSON_HEADERS,
    tags: { name: 'intake probe' },
  });
  if (isIntakePending(probe.status)) {
    console.warn(
      `flash-sale: PENDING, POST /api/store/orders answered ${String(probe.status)} (order intake is P3.S4)`,
    );
    return { pending: true, probeStatus: probe.status };
  }
  return { pending: false, probeStatus: probe.status, variantId: hotVariantId() };
}

/** @param {{ pending: boolean, variantId?: string }} data */
export default function submit(data) {
  if (data.pending || data.variantId === undefined) return;
  const quote = post('/api/store/cart-quote', cartQuoteBody(data.variantId, WILAYA), 'cart quote');
  if (!check(quote, { 'cart quote answers 200': (r) => r.status === 200 })) return void intakeUnexpected.add(1);
  const { quoteToken } = /** @type {{ quoteToken: string }} */ (quote.json());
  const order = post('/api/store/orders', intakeBody(quoteToken, exec.scenario.iterationInTest, WILAYA), 'intake');
  intakeDuration.add(order.timings.duration);
  if (!check(order, { 'intake accepted': (r) => ACCEPTED.includes(r.status) })) intakeUnexpected.add(1);
}

/** @param {Parameters<typeof summaryFiles>[2]} data */
export function handleSummary(data) {
  return summaryFiles('flash-sale', `k6 flash sale: ${target.host}, peak ${String(PEAK)}/s`, data, __ENV.SUMMARY_DIR);
}
