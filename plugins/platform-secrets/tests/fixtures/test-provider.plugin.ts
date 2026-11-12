import { Inject } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { TenantSecretProviderRegistry } from '../../application/provider-registry';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';

/** The provider the integration tests store secrets for, and the shape of its refs. */
export const TEST_PROVIDER = 'test-provider';
export const TEST_REF_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

/** Registers {@link TEST_PROVIDER} the way a real provider plugin does, in `onModuleInit`. */
@VendurePlugin({ imports: [PluginCommonModule, PlatformSecretsPlugin] })
export class TestProviderPlugin {
  constructor(@Inject(TenantSecretProviderRegistry) private readonly registry: TenantSecretProviderRegistry) {}

  onModuleInit(): void {
    this.registry.register({ provider: TEST_PROVIDER, refPattern: TEST_REF_PATTERN });
  }
}
