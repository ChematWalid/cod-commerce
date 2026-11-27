/**
 * Splits `rows` into consecutive chunks of `size` rows, the last one shorter, so a multi-row statement stays under
 * the database's bound-parameter limit.
 * @throws {RangeError} when `size` is not a positive integer.
 */
export function chunksOf<Row>(rows: readonly Row[], size: number): Row[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError(`Chunk size must be a positive integer, got ${String(size)}`);
  const chunks: Row[][] = [];
  for (let start = 0; start < rows.length; start += size) chunks.push(rows.slice(start, start + size));
  return chunks;
}
