/** Whether the business or store an override names exists (D116). */
export interface ScopeDirectoryPort {
  businessExists(businessId: string): Promise<boolean>;
  /** An active store of an active business: the stores that serve buyers. */
  activeStoreExists(storeId: string): Promise<boolean>;
}
