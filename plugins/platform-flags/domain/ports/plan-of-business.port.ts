/** The plan a business is on. Plans arrive with P9.S1; until then nothing has one. */
export interface PlanOfBusinessPort {
  /** The business's plan key, or undefined when it has none. */
  planKeyOf(businessId: string): Promise<string | undefined>;
}
