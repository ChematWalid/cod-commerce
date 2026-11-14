/** How many characters of a refused value an error message shows. */
const VALUE_PREVIEW_LENGTH = 32;

/** Anything outside printable ASCII, replaced in a preview. */
const NON_PRINTABLE_ASCII = /[^\x20-\x7e]/gu;

/**
 * Renders a refused input for an error message: JSON-quoted, cut to 32 characters, every character
 * outside printable ASCII replaced by `?`; a non-string becomes its type, e.g. `(number)`.
 * Refused inputs often come from callers' data, so they must not flood or inject into logs.
 */
export function previewValue(value: unknown): string {
  if (typeof value !== 'string') {
    return `(${value === null ? 'null' : typeof value})`;
  }
  const escaped = JSON.stringify(value.slice(0, VALUE_PREVIEW_LENGTH)).replace(NON_PRINTABLE_ASCII, '?');
  return value.length > VALUE_PREVIEW_LENGTH ? `${escaped}…` : escaped;
}
