/** The byte order mark Excel writes before a UTF-8 CSV, read as text. */
const UTF8_BOM = '\uFEFF';

/**
 * The text of strict UTF-8 `bytes` without its byte order mark (D2209, as Excel writes it), or `undefined` when the
 * bytes are not UTF-8: a CSV read never guesses another encoding nor replaces a bad byte.
 */
export function strictUtf8Text(bytes: Uint8Array): string | undefined {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error: unknown) {
    // A fatal decoder throws a TypeError for bytes that are not UTF-8; anything else is a fault.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
  return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
}
