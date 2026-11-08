/** Injection token of the `ChannelProvisionerPort` adapter. */
export const CHANNEL_PROVISIONER: unique symbol = Symbol('TenancyChannelProvisioner');

/** Injection token of the `IdGeneratorPort` adapter. */
export const ID_GENERATOR: unique symbol = Symbol('TenancyIdGenerator');

/** Injection token of the `PlatformStorePort` adapter. */
export const PLATFORM_STORE: unique symbol = Symbol('TenancyPlatformStore');

/** Injection token of the `TransactionPort` adapter. */
export const TRANSACTION: unique symbol = Symbol('TenancyTransaction');

/** Injection token of the {@link TenancyPorts} bundle the use cases take. */
export const TENANCY_PORTS: unique symbol = Symbol('TenancyPorts');
