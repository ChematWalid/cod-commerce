/** Injection token of the `ChannelProvisionerPort` adapter. */
export const CHANNEL_PROVISIONER: unique symbol = Symbol('TenancyChannelProvisioner');

/** Injection token of the `AssetAccessPort` adapter. */
export const ASSET_ACCESS: unique symbol = Symbol('TenancyAssetAccess');

/** Injection token of the `IdGeneratorPort` adapter. */
export const ID_GENERATOR: unique symbol = Symbol('TenancyIdGenerator');

/** Injection token of the `PlatformStorePort` adapter. */
export const PLATFORM_STORE: unique symbol = Symbol('TenancyPlatformStore');

/** Injection token of the `TransactionPort` adapter. */
export const TRANSACTION: unique symbol = Symbol('TenancyTransaction');

/** Injection token of the {@link TenancyPorts} bundle the use cases take. */
export const TENANCY_PORTS: unique symbol = Symbol('TenancyPorts');

/** Injection token of the `TenantStoresPort` adapter. */
export const TENANT_STORES: unique symbol = Symbol('TenancyTenantStores');

/** Injection token of the `StoreHostInvalidatorPort` adapter. */
export const STORE_HOST_INVALIDATOR: unique symbol = Symbol('TenancyStoreHostInvalidator');

/** Injection token of the {@link StoreAdminPorts} bundle the store use cases take. */
export const STORE_ADMIN_PORTS: unique symbol = Symbol('TenancyStoreAdminPorts');

/** Injection token of the `TenantContextResolverPort` adapter. */
export const TENANT_CONTEXT_RESOLVER: unique symbol = Symbol('TenancyTenantContextResolver');

/** Injection token of the process-local `HostCachePort`. */
export const HOST_LOCAL_CACHE: unique symbol = Symbol('TenancyHostLocalCache');

/** Injection token of the Valkey-backed `HostCachePort`. */
export const HOST_SHARED_CACHE: unique symbol = Symbol('TenancyHostSharedCache');

/** Injection token of the `TenantLifecycleRegistry`; internal, since holding it means firing events. */
export const TENANT_LIFECYCLE: unique symbol = Symbol('TenancyTenantLifecycle');

/** Injection token of the register-only `TenantLifecycleRegistrar` other plugins add their hooks through. */
export const TENANT_LIFECYCLE_REGISTRAR: unique symbol = Symbol('TenancyTenantLifecycleRegistrar');
