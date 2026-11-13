import { FeatureFlags } from '@cod/plugin-platform-flags';
import { isFlagKey } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { KillSwitchPort } from '../application/ports';

/**
 * The gateway's kill switch (D109), read from the operational flags: platform-wide, so no business is asked for. A
 * key that is not one of the flags reads as off rather than throwing into a request.
 */
@Injectable()
export class FlagKillSwitch implements KillSwitchPort {
  constructor(@Inject(FeatureFlags) private readonly flags: FeatureFlags) {}

  isEnabled(flagKey: string): Promise<boolean> {
    return isFlagKey(flagKey) ? this.flags.isEnabledFor({}, flagKey) : Promise.resolve(false);
  }
}
