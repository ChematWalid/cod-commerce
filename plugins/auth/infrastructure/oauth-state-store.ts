import type { OAuthFlowState } from '../domain/oauth';
import type { OAuthStateStorePort } from '../domain/ports/oauth-state-store.port';
import type { PayloadSealerPort } from '../domain/ports/payload-sealer.port';
import { SealedPayloadError } from './sealed-payload';

/**
 * The flow travels inside `state` itself, sealed, so a flow abandoned at the provider leaves nothing to clean up.
 * It is given a sealer with its own context (`OAUTH_STATE_SEAL_CONTEXT`), which keeps it apart from the mail queue's.
 */
export class SealedOAuthStateStore implements OAuthStateStorePort {
  constructor(private readonly sealer: PayloadSealerPort) {}

  write(state: OAuthFlowState): string {
    return this.sealer.seal(state);
  }

  read(state: string): OAuthFlowState | undefined {
    try {
      return this.sealer.open(state) as OAuthFlowState;
    } catch (error: unknown) {
      if (error instanceof SealedPayloadError) {
        return undefined;
      }
      throw error;
    }
  }
}
