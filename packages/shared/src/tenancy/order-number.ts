/** Minimum digits of a displayed order number; larger numbers keep growing. */
export const ORDER_NUMBER_DIGITS = 8;

/** Formats a per-business sequence value for display, e.g. `1n` becomes `#00000001`. */
export function formatOrderNumber(sequenceValue: bigint): string {
  return `#${sequenceValue.toString().padStart(ORDER_NUMBER_DIGITS, '0')}`;
}
