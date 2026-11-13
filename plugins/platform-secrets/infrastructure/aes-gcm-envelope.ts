import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AES_KEY_BYTES, GCM_IV_BYTES, GCM_TAG_BYTES } from '../domain/constants';
import { SecretUnreadableError } from '../domain/errors';
import type { EnvelopeCipherPort, SealedBytes } from '../domain/ports/envelope-cipher.port';

const ALGORITHM = 'aes-256-gcm';

/** AES-256-GCM with a fresh 96-bit nonce per seal and the full 128-bit tag. */
export class AesGcmEnvelope implements EnvelopeCipherPort {
  newDataKey(): Buffer {
    return randomBytes(AES_KEY_BYTES);
  }

  seal(key: Buffer, plaintext: Buffer, aad: Buffer): SealedBytes {
    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: GCM_TAG_BYTES });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { iv, ciphertext, tag: cipher.getAuthTag() };
  }

  open(key: Buffer, sealed: SealedBytes, aad: Buffer): Buffer {
    // A tag cut short would let GCM accept a forgery with far fewer bits to guess, so the shape is checked first.
    if (key.length !== AES_KEY_BYTES || sealed.iv.length !== GCM_IV_BYTES || sealed.tag.length !== GCM_TAG_BYTES) {
      throw new SecretUnreadableError();
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, sealed.iv, { authTagLength: GCM_TAG_BYTES });
      decipher.setAAD(aad);
      decipher.setAuthTag(sealed.tag);
      return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
    } catch {
      // Node's message names the failed authentication; the row's own bytes are the only thing worth keeping out.
      throw new SecretUnreadableError();
    }
  }
}
