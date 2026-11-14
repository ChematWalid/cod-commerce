/**
 * The id of a Vendure row (product, asset) as the catalog carries it: a decimal string. Our own rows use snowflakes;
 * a core id is the engine's integer and is never one.
 */
export type CoreId = string;
