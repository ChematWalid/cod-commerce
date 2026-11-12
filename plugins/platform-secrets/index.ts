export { TenantSecretProviderRegistry, type TenantSecretProvider } from './application/provider-registry';
export {
  type PutTenantSecretInput,
  TenantSecretService,
  type TenantSecretView,
} from './application/tenant-secret.service';
export {
  InvalidSecretValueError,
  ProviderRegistrationError,
  SecretNotFoundError,
  SecretUnreadableError,
  UnknownProviderError,
} from './domain/errors';
export type { KekRing } from './domain/ports/envelope-cipher.port';
export { InvalidKekRingError, type KekEntry, parseKekEntries, parseKekRing } from './infrastructure/kek-ring';
export { TenantDataKeyEntity } from './infrastructure/tenant-data-key.entity';
export { TenantSecretEntity } from './infrastructure/tenant-secret.entity';
export { PlatformSecretsPlugin, type PlatformSecretsOptions } from './platform-secrets.plugin';
