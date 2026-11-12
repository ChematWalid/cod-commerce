import { Injectable } from '@nestjs/common';
import type { KillSwitchPort } from '../application/ports';

/**
 * The kill switch until the flags plugin (Task 16) provides the real one: every flag is on unless a caller in this
 * process switched it off. Tests use `setEnabled` to turn the gateway off.
 */
@Injectable()
export class ConfigurableKillSwitch implements KillSwitchPort {
  private readonly off = new Set<string>();

  isEnabled(flagKey: string): Promise<boolean> {
    return Promise.resolve(!this.off.has(flagKey));
  }

  /** Switches `flagKey` on or off for this process. */
  setEnabled(flagKey: string, enabled: boolean): void {
    if (enabled) this.off.delete(flagKey);
    else this.off.add(flagKey);
  }
}
