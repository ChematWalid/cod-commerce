/** Injection token of the {@link KekRing}. */
export const KEK_RING: unique symbol = Symbol('TenantSecretKekRing');

/** Injection token of the `EnvelopeCipherPort` adapter. */
export const ENVELOPE_CIPHER: unique symbol = Symbol('TenantSecretEnvelopeCipher');

/** Injection token of the `DataKeyRepositoryPort` adapter. */
export const DATA_KEY_REPOSITORY: unique symbol = Symbol('TenantSecretDataKeyRepository');

/** Injection token of the `SecretRepositoryPort` adapter. */
export const SECRET_REPOSITORY: unique symbol = Symbol('TenantSecretRepository');

/** Injection token of the {@link SecretLogger}. */
export const SECRET_LOGGER: unique symbol = Symbol('TenantSecretLogger');

/** Injection token of the adapters bundled as `SecretPorts`. */
export const SECRET_PORTS: unique symbol = Symbol('TenantSecretPorts');
