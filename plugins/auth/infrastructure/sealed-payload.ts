import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { PayloadSealerPort } from '../domain/ports/payload-sealer.port';

/** HKDF label of the sealing key: it keeps that key apart from the HMAC key `AUTH_TOKEN_SECRET` also feeds (D25). */
export const SEAL_KEY_LABEL = 'cod/auth-email/payload-seal/v1';

const FORMAT_PREFIX = 'v1.';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CIPHER = 'aes-256-gcm';

/** A sealed value that cannot be opened. Its message never quotes the value. */
export class SealedPayloadError extends Error {
  constructor() {
    super('Sealed payload cannot be opened');
    this.name = 'SealedPayloadError';
  }
}

/**
 * AES-256-GCM under a key derived from the token secret with HKDF-SHA-256 and a distinct label, so the secret
 * itself is never the cipher key. Rotating the secret makes queued payloads unreadable: they are minutes old.
 */
export class SealedPayloadCodec implements PayloadSealerPort {
  private readonly key: Buffer;

  constructor(secret: string, label: string = SEAL_KEY_LABEL) {
    this.key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), label, KEY_BYTES));
  }

  seal(payload: unknown): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(CIPHER, this.key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return FORMAT_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  }

  open(sealed: string): unknown {
    if (!sealed.startsWith(FORMAT_PREFIX)) {
      throw new SealedPayloadError();
    }
    const bytes = Buffer.from(sealed.slice(FORMAT_PREFIX.length), 'base64url');
    if (bytes.length <= IV_BYTES + TAG_BYTES) {
      throw new SealedPayloadError();
    }
    try {
      const decipher = createDecipheriv(CIPHER, this.key, bytes.subarray(0, IV_BYTES));
      decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      const plain = Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
      return JSON.parse(plain.toString('utf8')) as unknown;
    } catch {
      throw new SealedPayloadError();
    }
  }
}
