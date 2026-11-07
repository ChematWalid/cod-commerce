import { GlobalSettingsService, type Injector, type RequestContext } from '@vendure/core';
import { hasPlatformLanguages, PLATFORM_LANGUAGES, seedChange } from './seed.constants';

/** Ensures the global available languages are exactly the platform languages (ar, fr, en), in that order. */
export async function ensureAvailableLanguages(ctx: RequestContext, injector: Injector): Promise<string[]> {
  const settingsService = injector.get(GlobalSettingsService);
  const settings = await settingsService.getSettings(ctx);
  // Deprecated in favour of the channel's languages (set by ensureDefaultChannel), but Vendure still checks a
  // channel's default language against this list, so both are kept in step.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (hasPlatformLanguages(settings.availableLanguages)) {
    return [];
  }
  await settingsService.updateSettings(ctx, { availableLanguages: [...PLATFORM_LANGUAGES] });
  return [seedChange('global-settings', 'availableLanguages')];
}
