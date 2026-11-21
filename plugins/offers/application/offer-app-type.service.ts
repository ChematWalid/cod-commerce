import type { OfferAppType } from '@cod/shared';
import { OFFER_APP_TYPES } from '../domain/app-types';

/** Where an app registers its own card of the create dialog (injected as `OFFER_APP_TYPE_REGISTRAR`, D2515). */
export interface OfferAppTypeRegistrar {
  /** @throws {Error} when an app type with the same id is already listed: two cards would open one editor. */
  register(appType: Readonly<OfferAppType>): void;
}

/**
 * The cards of the create dialog (D2515): the built-in app types in catalogue order, then the ones apps registered
 * on bootstrap, in registration order (none until P9.S8b).
 */
export class OfferAppTypeService implements OfferAppTypeRegistrar {
  private readonly registered: Readonly<OfferAppType>[] = [];

  register(appType: Readonly<OfferAppType>): void {
    if (this.list().some((listed) => listed.id === appType.id)) {
      throw new Error(`An offer app type "${appType.id}" is already listed`);
    }
    this.registered.push({ ...appType });
  }

  /** Every app type, built-in first. */
  list(): readonly Readonly<OfferAppType>[] {
    return [...OFFER_APP_TYPES, ...this.registered];
  }
}
