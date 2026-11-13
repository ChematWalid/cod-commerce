/** What an override is attached to (D116). */
export const OVERRIDE_SCOPES = ['plan', 'business', 'store'] as const;

/** One of the {@link OVERRIDE_SCOPES}. */
export type OverrideScope = (typeof OVERRIDE_SCOPES)[number];

/** An override as the evaluator reads it. */
export interface OverrideState {
  readonly scope: OverrideScope;
  readonly scopeId: string;
  readonly enabled: boolean;
}

/** A flag and its overrides. `updatedAt` is an ISO string so the snapshot survives JSON in Valkey. */
export interface FlagState {
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly rolloutPercent: number;
  readonly updatedAt: string;
  readonly overrides: readonly OverrideState[];
}

/** Every flag, by key: the one object that is cached in the process and in Valkey. */
export interface FlagSnapshot {
  readonly flags: Readonly<Record<string, FlagState>>;
}

/** Who a flag is asked for: a request with a tenant has both, a platform job has neither. */
export interface FlagSubject {
  readonly businessId?: string;
  readonly storeId?: string;
}
