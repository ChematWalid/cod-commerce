import { FeatureFlags } from '@cod/plugin-platform-flags';
import { FLAG_KEYS } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { AiSwitchPort } from '../application/ports/ai-switch.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * The AI hooks' kill switch (D2215), read from the operational flag `ai.enabled` for the store's business and store,
 * as `plugins/platform-webhooks/infrastructure/flag-kill-switch.ts` reads its own. Staff turn it off during an incident.
 */
@Injectable()
export class FlagAiSwitch implements AiSwitchPort {
  constructor(@Inject(FeatureFlags) private readonly flags: FeatureFlags) {}

  isEnabled(scope: StoreScope): Promise<boolean> {
    return this.flags.isEnabledFor({ businessId: scope.businessId, storeId: scope.storeId }, FLAG_KEYS.ai);
  }
}
