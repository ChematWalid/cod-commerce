import type { StoreScope } from '../../domain/store-scope';

/** The `ai.enabled` kill switch (D116, D2215) as the store sees it. */
export interface AiSwitchPort {
  isEnabled(scope: StoreScope): Promise<boolean>;
}
