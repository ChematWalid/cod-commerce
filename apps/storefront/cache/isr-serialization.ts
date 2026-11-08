/** How a `Map` is written to JSON; `JSON.stringify` alone would turn it into `{}`. */
interface SerializedMap {
  readonly __type: 'Map';
  readonly value: [unknown, unknown][];
}

/** What `Buffer#toJSON()` produces. */
interface SerializedBuffer {
  readonly type: 'Buffer';
  readonly data: number[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isSerializedMap = (value: unknown): value is SerializedMap =>
  isRecord(value) && value['__type'] === 'Map' && Array.isArray(value['value']);

const isSerializedBuffer = (value: unknown): value is SerializedBuffer =>
  isRecord(value) && value['type'] === 'Buffer' && Array.isArray(value['data']);

/**
 * Serialises an ISR entry. App page entries hold `Buffer`s (`rscData`) and a `Map` (`segmentData`), which
 * plain JSON loses; both are tagged here and rebuilt by {@link deserializeIsrEntry}.
 */
export function serializeIsrEntry(entry: unknown): string {
  return JSON.stringify(entry, (_key, value: unknown) =>
    value instanceof Map ? { __type: 'Map', value: Array.from(value.entries()) } : value,
  );
}

/** Rebuilds an entry written by {@link serializeIsrEntry}, with its `Map`s and `Buffer`s. */
export function deserializeIsrEntry(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (isSerializedMap(value)) return new Map(value.value);
    if (isSerializedBuffer(value)) return Buffer.from(value.data);
    return value;
  });
}
