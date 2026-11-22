import type { Provider } from '@nestjs/common';
import { type StoreReferenceCheckRegistrar, StoreReferenceRegistry } from '../application/store-reference.registry';
import { STORE_REFERENCE_CHECK_REGISTRAR, STORE_REFERENCE_CHECKS } from '../application/tokens';

/**
 * The store reference seam (D3111): the registry the store use cases read, and the register-only view other plugins
 * receive, as the lifecycle registrar is wired.
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
];
