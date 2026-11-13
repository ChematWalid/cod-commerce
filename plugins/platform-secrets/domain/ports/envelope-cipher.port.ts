/** What AES-GCM produces: the nonce, the encrypted bytes and the authentication tag. */
export interface SealedBytes {
  readonly iv: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

/** The key-encryption keys of a deployment: any listed kid can unwrap, the active one wraps new data keys. */
export interface KekRing {
  readonly activeKid: string;
  /** A copy of the key for `kid`. @throws when the ring holds no such kid. */
  key(kid: string): Buffer;
}

/** Authenticated encryption with AES-256-GCM (D114). Used for values (under a data key) and for data keys (under a KEK). */
export interface EnvelopeCipherPort {
  /** A new random 256-bit key. */
  newDataKey(): Buffer;

  /** Encrypts `plaintext` under `key`, binding `aad`, with a fresh nonce. */
  seal(key: Buffer, plaintext: Buffer, aad: Buffer): SealedBytes;

  /**
   * Decrypts and authenticates.
   *
   * @throws {SecretUnreadableError} for another key or AAD, or any altered byte.
   */
  open(key: Buffer, sealed: SealedBytes, aad: Buffer): Buffer;
}
