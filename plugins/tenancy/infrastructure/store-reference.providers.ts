import type { Provider } from '@nestjs/common';
import { type StoreReferenceCheckRegistrar, StoreReferenceRegistry } from '../application/store-reference.registry';
import { STORE_REFERENCE_CHECK_REGISTRAR, STORE_REFERENCE_CHECKS } from '../application/tokens';
import { StoreDeliveryDefaults } from '../domain/ports/store-delivery-defaults.port';
import { TenantStoreDeliveryDefaults } from './store-delivery-defaults.adapter';

/**
 * The store reference seam (D3111): the registry the store use cases read, the register-only view other plugins
 * receive (wired as the lifecycle registrar is), and the platform-only link of a store's default fee group.
 */
export const storeReferenceProviders: Provider[] = [
  { provide: STORE_REFERENCE_CHECKS, useClass: StoreReferenceRegistry },
  {
    provide: STORE_REFERENCE_CHECK_REGISTRAR,
    useFactory: (registry: StoreReferenceRegistry): StoreReferenceCheckRegistrar => ({
      register: (check) => {
        registry.register(check);
      },
    }),
    inject: [STORE_REFERENCE_CHECKS],
  },
  { provide: StoreDeliveryDefaults, useClass: TenantStoreDeliveryDefaults },
];
