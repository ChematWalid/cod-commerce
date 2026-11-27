/** What the store host answers for a route the storefront does not serve, or serves for GET only. */
const NOT_DEPLOYED_STATUSES = [404, 405];

/**
 * Whether the same-origin intake route is still missing: order intake arrives with P3.S4, and until then the
 * flash-sale scenario skips with a notice instead of failing. Any other answer, a 400 for an empty probe body
 * included, means the route is live.
 *
 * @param {number} status the status of the probe `POST /api/store/orders`
 * @returns {boolean}
 */
export function isIntakePending(status) {
  return NOT_DEPLOYED_STATUSES.includes(status);
}

/**
 * The body of one cart quote for a single unit of the hot variant. The shape follows the P3.S3/P3.S4 briefs and is
 * checked against the real schema when P3.S4 lands (the scenario is pending until then).
 *
 * @param {string} variantId
 * @param {number} wilaya the delivery wilaya code
 */
export function cartQuoteBody(variantId, wilaya) {
  return { items: [{ variantId, quantity: 1 }], wilaya, deliveryType: 'home' };
}

/**
 * The body of one order intake from a quote token: a synthetic buyer per iteration, so each submit is a distinct
 * order (the replay key is per quote, the abandoned-checkout upsert per device and phone).
 *
 * @param {string} quoteToken the signed quote from the cart quote
 * @param {number} iteration the k6 global iteration number, unique per submit
 * @param {number} wilaya the delivery wilaya code
 */
export function intakeBody(quoteToken, iteration, wilaya) {
  const serial = String(iteration).padStart(8, '0');
  return {
    quoteToken,
    name: `Load test ${serial}`,
    phone: `05${serial}`,
    wilaya,
    commune: 'synthetic',
    deviceId: `k6-flash-sale-${serial}`,
  };
}
