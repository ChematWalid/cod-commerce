import type { OAuthFlowState } from '../oauth';

/** Keeps a flow's PKCE verifier and browser binding across the trip to the provider. */
export interface OAuthStateStorePort {
  /** The opaque `state` value to send to the provider. */
  write(state: OAuthFlowState): string;
  /** The flow behind a `state` value; `undefined` when it was altered or is not one of ours. */
  read(state: string): OAuthFlowState | undefined;
}
