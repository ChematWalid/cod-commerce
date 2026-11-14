// A verbatim copy of plugins/auth/domain/image-format.ts (without MAX_IMAGE_PIXELS, which auth's content guard
// applies to every upload): a plugin never imports another plugin's internals (§3a.2). Keep the two in step until the
// shared copy of the follow-up issue replaces both.
/** A raster image format the platform accepts for uploads, with the extension a stored file gets (D34). */
export interface ImageFormat {
  readonly mimeType: string;
  readonly extension: string;
}

/** SVG is left out on purpose: it is markup that can carry script. */
export const IMAGE_FORMATS = {
  png: { mimeType: 'image/png', extension: 'png' },
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  gif: { mimeType: 'image/gif', extension: 'gif' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
} as const satisfies Record<string, ImageFormat>;

/** The leading bytes that tell the formats apart; the longest signature (WebP's) needs 12. */
const SIGNATURE_BYTES = 12;

interface KnownSignature {
  readonly format: ImageFormat;
  /** Matches the hex of the first {@link SIGNATURE_BYTES} bytes. */
  readonly hex: RegExp;
}

const KNOWN_SIGNATURES: readonly KnownSignature[] = [
  // 0x89 "PNG" CR LF 0x1A LF
  { format: IMAGE_FORMATS.png, hex: /^89504e470d0a1a0a/ },
  // FF D8 FF
  { format: IMAGE_FORMATS.jpeg, hex: /^ffd8ff/ },
  // "GIF87a" or "GIF89a"
  { format: IMAGE_FORMATS.gif, hex: /^47494638(37|39)61/ },
  // "RIFF", a four-byte length, "WEBP"
  { format: IMAGE_FORMATS.webp, hex: /^52494646[0-9a-f]{8}57454250/ },
];

/**
 * The accepted image format of `bytes`, read from the bytes alone: a client's claimed mimetype and file name play no
 * part. Anything else, SVG included, is `undefined`.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | undefined {
  const head = Buffer.from(bytes.subarray(0, SIGNATURE_BYTES)).toString('hex');
  return KNOWN_SIGNATURES.find(({ hex }) => hex.test(head))?.format;
}
