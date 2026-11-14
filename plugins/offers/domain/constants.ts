/** Orders a buyer has before their first one: a `first` audience offer is for a buyer with this many (D2418). */
export const FIRST_ORDER_COUNT = 0;

/**
 * Target roles whose lines an offer counts and discounts (D2410). A set, not a comparison: P2.S5 adds the `get` and
 * `addon` roles, which are not bought lines.
 */
export const BUY_ROLES: ReadonlySet<string> = new Set(['buy']);
