import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { LinkImportService } from '../application/link-import.service';
import { PolishProductService } from '../application/polish-product.service';
import type { AiSwitchPort } from '../application/ports/ai-switch.port';
import type { CatalogImportPort, ProductOriginWrites } from '../application/ports/catalog-import.port';
import type { LinkImportActivityPort, LinkJobStore } from '../application/ports/link-job.port';
import type { LinkScraper } from '../application/ports/link-scraper.port';
import type { ProductPolisher, ProductTextReads } from '../application/ports/product-polisher.port';
import type { UnitOfWorkPort } from '../application/ports/unit-of-work.port';
import {
  AI_SWITCH,
  CATALOG_IMPORT,
  IMAGE_CLEANUP,
  LINK_JOBS,
  LINK_SCRAPER,
  PRODUCT_ACTIVITY,
  PRODUCT_ORIGIN_WRITES,
  PRODUCT_POLISHER,
  PRODUCT_TEXTS,
  UNIT_OF_WORK,
} from '../application/tokens';
import { FlagAiSwitch } from './ai-kill-switch';
import { CatalogProductTextAdapter } from './catalog-product-text.adapter';
import { FixtureLinkScraper } from './fixture-link-scraper';
import { HttpLinkScraper } from './http-link-scraper';
import { IdentityImageCleanup } from './identity-image-cleanup';
import { IdentityPolisher } from './identity-polisher';
import { type CatalogImportPluginOptions, requireCatalogImportOptions } from './plugin-options';
import { TypeOrmLinkJobStore } from './typeorm-link-job.store';

/** The scraper the options name (D2214): the guarded HTTP one, or synthetic pages (refused in production at init). */
export function linkScraperOf(options: CatalogImportPluginOptions): LinkScraper {
  return options.linkScraper === 'fixture' ? new FixtureLinkScraper() : new HttpLinkScraper();
}

/** Link import and the AI hooks (D2214, D2215): their ports, adapters and use cases. */
export const LINK_IMPORT_PROVIDERS: Provider[] = [
  // Read when the app is built, not at import time: the last `init` wins (D2208).
  { provide: LINK_SCRAPER, useFactory: () => linkScraperOf(requireCatalogImportOptions()) },
  { provide: LINK_JOBS, useClass: TypeOrmLinkJobStore },
  { provide: AI_SWITCH, useClass: FlagAiSwitch },
  { provide: PRODUCT_POLISHER, useClass: IdentityPolisher },
  { provide: PRODUCT_TEXTS, useClass: CatalogProductTextAdapter },
  { provide: IMAGE_CLEANUP, useFactory: (ai: AiSwitchPort) => new IdentityImageCleanup(ai), inject: [AI_SWITCH] },
  {
    provide: LinkImportService,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the use case holds
    useFactory: (
      scraper: LinkScraper,
      catalog: CatalogImportPort,
      origins: ProductOriginWrites,
      jobs: LinkJobStore,
      activity: LinkImportActivityPort,
      units: UnitOfWorkPort,
      ids: SnowflakeIdGeneratorPort,
    ) => new LinkImportService({ scraper, catalog, origins, jobs, activity, units, ids }),
    inject: [
      LINK_SCRAPER,
      CATALOG_IMPORT,
      PRODUCT_ORIGIN_WRITES,
      LINK_JOBS,
      PRODUCT_ACTIVITY,
      UNIT_OF_WORK,
      SNOWFLAKE_ID_GENERATOR,
    ],
  },
  {
    provide: PolishProductService,
    useFactory: (ai: AiSwitchPort, products: ProductTextReads, polisher: ProductPolisher) =>
      new PolishProductService({ ai, products, polisher }),
    inject: [AI_SWITCH, PRODUCT_TEXTS, PRODUCT_POLISHER],
  },
];
