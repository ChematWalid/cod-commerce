import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { I18nService } from '@vendure/core';
import ar from './i18n/ar.json';
import en from './i18n/en.json';
import fr from './i18n/fr.json';

/** Registers the plugin's API error messages with Vendure once i18next is initialised. */
@Injectable()
export class AuthTranslations implements OnApplicationBootstrap {
  constructor(private readonly i18n: I18nService) {}

  onApplicationBootstrap(): void {
    this.i18n.addTranslation('en', en);
    this.i18n.addTranslation('ar', ar);
    this.i18n.addTranslation('fr', fr);
  }
}
