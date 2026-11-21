import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { I18nService } from '@vendure/core';
import ar from './i18n/ar.json';
import en from './i18n/en.json';

/** Registers the offers API's error messages with Vendure once i18next is initialised (D2520). */
@Injectable()
export class OffersTranslations implements OnApplicationBootstrap {
  constructor(private readonly i18n: I18nService) {}

  onApplicationBootstrap(): void {
    this.i18n.addTranslation('en', en);
    this.i18n.addTranslation('ar', ar);
  }
}
