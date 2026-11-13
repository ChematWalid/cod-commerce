import { PROVIDER_PATTERN, REF_MAX_LENGTH } from '../domain/constants';
import { InvalidSecretValueError, ProviderRegistrationError, UnknownProviderError } from '../domain/errors';

/** A kind of secret a feature stores: its name and the shape of its refs (`signing`, `api-key`, an account id). */
export interface TenantSecretProvider {
  readonly provider: string;
  readonly refPattern: RegExp;
}

/**
 * The providers that may keep secrets. Feature plugins register theirs in `onModuleInit`; a secret for a provider
 * nobody registered is refused, so the store holds only what some feature can read back.
 */
export class TenantSecretProviderRegistry {
  private readonly providers = new Map<string, RegExp>();

  /**
   * @throws {ProviderRegistrationError} for a name that is not kebab-case within 40 characters, or a name already registered.
   */
  register(provider: TenantSecretProvider): void {
    if (!PROVIDER_PATTERN.test(provider.provider)) {
      throw new ProviderRegistrationError('the name is kebab-case, starts with a letter and has at most 40 characters');
    }
    if (this.providers.has(provider.provider)) {
      throw new ProviderRegistrationError(`"${provider.provider}" is already registered`);
    }
    // A global or sticky pattern remembers `lastIndex` between tests; the registry matches without state.
    this.providers.set(
      provider.provider,
      new RegExp(provider.refPattern.source, provider.refPattern.flags.replace(/[gy]/g, '')),
    );
  }

  /**
   * @throws {UnknownProviderError} when nobody registered `provider`.
   * @throws {InvalidSecretValueError} when `ref` is too long or does not match the provider's pattern.
   */
  assertAccepts(provider: string, ref: string): void {
    const pattern = this.providers.get(provider);
    if (pattern === undefined) {
      throw new UnknownProviderError();
    }
    if (ref.length === 0 || ref.length > REF_MAX_LENGTH || !pattern.test(ref)) {
      throw new InvalidSecretValueError('the ref does not fit this provider');
    }
  }
}
