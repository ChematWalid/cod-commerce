import { check } from 'k6';
import http from 'k6/http';
import { Counter } from 'k6/metrics';

/** Answers that are the platform's fault: a 5xx, or no answer at all (status 0). Every script fails on one. */
export const serverErrors = new Counter('server_errors');

const FIRST_SERVER_ERROR = 500;

/**
 * Counts a response in `server_errors` when it is a 5xx or a transport failure.
 *
 * @param {import('k6/http').RefinedResponse<any>} response
 * @param {string} name the request's `name` tag
 */
export function countServerError(response, name) {
  if (response.status === 0 || response.status >= FIRST_SERVER_ERROR) serverErrors.add(1, { name });
}

/**
 * `GET <origin><path>` as the store host, checked for a 200, tagged by `name` so the summary groups dynamic paths.
 *
 * @param {{ origin: string, host: string }} target
 * @param {string} path
 * @param {string} name
 */
export function getPage(target, path, name) {
  const response = http.get(`${target.origin}${path}`, { headers: { Host: target.host }, tags: { name } });
  countServerError(response, name);
  check(response, { [`${name} answers 200`]: (r) => r.status === 200 });
  return response;
}

/**
 * The slugs of the store's first listed products (newest first), read through the storefront's same-origin store
 * api, as the store's own pages do. An empty list when the store has no listed product.
 *
 * @param {{ origin: string, host: string }} target
 * @param {number} take
 * @returns {string[]}
 */
export function productSlugsOf(target, take) {
  const response = getPage(target, `/api/store/products?take=${String(take)}`, 'store api products');
  if (response.status !== 200) return [];
  const page = /** @type {{ items: Array<{ slug: string }> }} */ (response.json());
  return page.items.map((item) => item.slug);
}

/** @param {string} slug */
export const productPath = (slug) => `/product/${encodeURIComponent(slug)}`;
