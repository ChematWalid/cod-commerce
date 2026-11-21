import { TextDecoder } from 'node:util';

/** How far into a page a `<meta charset>` is looked for, as browsers do (HTML's prescan). */
const PRESCAN_BYTES = 1_024;
const DEFAULT_CHARSET = 'utf-8';
const HEADER_CHARSET = /;\s*charset\s*=\s*"?([\w.:-]+)"?/i;
/** `<meta charset="x">` or `<meta http-equiv="content-type" content="text/html; charset=x">`. */
const META_CHARSET = /<meta[^>]+charset\s*=\s*["']?\s*([\w.:-]+)/i;

/** A decoder for `label`, or undefined when the runtime does not know it. */
function decoderOf(label: string | undefined): TextDecoder | undefined {
  if (label === undefined) return undefined;
  try {
    return new TextDecoder(label.trim());
  } catch (error: unknown) {
    // An unknown label is the page's mistake, not ours: fall back to the next source, as browsers do.
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/**
 * A page's bytes as text (D2272): in the charset its `content-type` declares, else its `<meta charset>`, else UTF-8.
 * A shop page served as windows-1256 or iso-8859-1 keeps its Arabic or French letters.
 */
export function decodePage(bytes: Uint8Array, contentType: string | undefined): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, PRESCAN_BYTES));
  const decoder =
    decoderOf(HEADER_CHARSET.exec(contentType ?? '')?.[1]) ??
    decoderOf(META_CHARSET.exec(head)?.[1]) ??
    new TextDecoder(DEFAULT_CHARSET);
  return decoder.decode(bytes);
}
