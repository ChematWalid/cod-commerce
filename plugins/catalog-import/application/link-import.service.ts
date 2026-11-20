import { isSnowflake, type LinkImportCommand } from '@cod/shared';
import { JobNotFoundError } from '../domain/errors';
import { linkDraftOf } from '../domain/link-draft';
import type { StoreScope } from '../domain/store-scope';
import type { JobIdGenerator } from './ports/export-queue.port';
import type { CatalogImportPort, ProductOriginWrites } from './ports/catalog-import.port';
import type { LinkImportActivityPort, LinkImportRecord, LinkJobStore } from './ports/link-job.port';
import type { LinkScraper } from './ports/link-scraper.port';
import type { OperationContext } from './ports/operation-context';
import type { ActivityActor } from './ports/product-activity.port';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** A link import as both API surfaces answer it (`CatalogLinkImport`). */
export interface LinkImportView {
  readonly importId: string;
  readonly status: string;
  readonly sourceUrl: string;
  readonly productId: string | null;
}

/** What {@link LinkImportService} runs through. */
export interface LinkImportDeps {
  readonly scraper: LinkScraper;
  readonly catalog: Pick<CatalogImportPort, 'create'>;
  readonly origins: Pick<ProductOriginWrites, 'recordLink'>;
  readonly jobs: LinkJobStore;
  readonly activity: LinkImportActivityPort;
  readonly units: UnitOfWorkPort;
  readonly ids: JobIdGenerator;
  readonly now?: () => Date;
}

const viewOf = (record: LinkImportRecord): LinkImportView => ({
  importId: record.id,
  status: record.status,
  sourceUrl: record.sourceUrl,
  productId: record.productId,
});

/**
 * "Import a product from a link" (D2214), synchronous: the page is scraped first (behind the SSRF guard, at most 5 s),
 * then one transaction creates the Draft through catalog's facade (D2201), its origin (`link`, `needsImageReview`,
 * image links stored only), the `link` job row and its activity row. A refused or unreachable link writes nothing.
 */
export class LinkImportService {
  private readonly now: () => Date;

  constructor(private readonly deps: LinkImportDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async importLink(
    ctx: OperationContext,
    scope: StoreScope,
    actor: ActivityActor,
    command: LinkImportCommand,
  ): Promise<LinkImportView> {
    const draft = linkDraftOf(await this.deps.scraper.scrape(command.url), command.url);
    const id = this.deps.ids.next();
    return this.deps.units.run(ctx, scope, async (tx) => {
      const productId = await this.deps.catalog.create(tx, scope, draft.create);
      await this.deps.origins.recordLink(tx, scope, { productId, importJobId: id, imageUrls: draft.imageUrls });
      const job = {
        id,
        sourceUrl: command.url,
        productId,
        actorAdministratorId: actor.administratorId,
        at: this.now(),
      };
      await this.deps.jobs.create(tx, scope, job);
      const imageCount = draft.imageUrls.length;
      await this.deps.activity.recordLinkImport(tx, { scope, importId: id, productId, imageCount, actor });
      return { importId: id, status: 'done', sourceUrl: command.url, productId };
    });
  }

  /**
   * The link import `id` of the caller's store.
   * @throws JobNotFoundError for any other id: another store's or business's, a spreadsheet import's, none
   */
  async status(ctx: OperationContext, scope: StoreScope, id: string): Promise<LinkImportView> {
    const record = isSnowflake(id) ? await this.deps.jobs.byId(ctx, scope, id) : undefined;
    if (record === undefined) throw new JobNotFoundError();
    return viewOf(record);
  }
}
