import { describe, expect, it } from 'vitest';
import { LinkImportService } from '../../application/link-import.service';
import type {
  LinkImportActivity,
  LinkImportRecord,
  LinkedOrigin,
  NewLinkImport,
} from '../../application/ports/link-job.port';
import type { ScrapedProduct } from '../../application/ports/link-scraper.port';
import { asOperationContext } from '../../application/ports/operation-context';
import type { ActivityActor } from '../../application/ports/product-activity.port';
import { LinkRefusedError } from '../../domain/errors';
import type { ImportCreate } from '../../domain/import-writes';
import { SCOPE } from '../support/scope';

const ctx = asOperationContext({});
const actor: ActivityActor = { administratorId: 5, ip: '192.0.2.1', userAgent: 'synthetic-agent' };
const LINK = 'https://shop.example.test/products/scarf';
const IMPORT_ID = '7001';
const PRODUCT_ID = '9001';

/** Every write a link import makes, in order; the unit of work only counts how often it opened. */
class FakeLinkWorld {
  readonly writes: string[] = [];
  readonly created: ImportCreate[] = [];
  readonly origins: LinkedOrigin[] = [];
  readonly jobs: NewLinkImport[] = [];
  readonly activities: LinkImportActivity[] = [];
  units = 0;

  constructor(private readonly scraped: () => Promise<ScrapedProduct>) {}

  service(): LinkImportService {
    return new LinkImportService({
      scraper: { scrape: () => this.scraped() },
      catalog: { create: (_tx, _scope, command) => this.write('create', this.created, command, PRODUCT_ID) },
      origins: { recordLink: (_tx, _scope, origin) => this.write('origin', this.origins, origin, undefined) },
      jobs: {
        create: (_tx, _scope, job) => this.write('job', this.jobs, job, undefined),
        byId: () => Promise.resolve<LinkImportRecord | undefined>(undefined),
      },
      activity: { recordLinkImport: (_tx, activity) => this.write('activity', this.activities, activity, undefined) },
      units: {
        run: (tx, _scope, work) => {
          this.units += 1;
          return work(tx);
        },
      },
      ids: { next: () => IMPORT_ID },
      now: () => new Date('2026-11-20T10:00:00Z'),
    });
  }

  private write<T, R>(name: string, list: T[], value: T, answer: R): Promise<R> {
    this.writes.push(name);
    list.push(value);
    return Promise.resolve(answer);
  }
}

describe('LinkImportService (D2214, D2272)', () => {
  it('a scraper refusal opens no unit and writes nothing', async () => {
    // Arrange
    const world = new FakeLinkWorld(() => Promise.reject(new LinkRefusedError()));

    // Act
    const failure = world
      .service()
      .importLink(ctx, SCOPE, actor, { url: 'http://169.254.169.254/' })
      .catch((error: unknown) => error);

    // Assert
    expect(await failure).toBeInstanceOf(LinkRefusedError);
    expect(world.units).toBe(0);
    expect(world.writes).toEqual([]);
  });

  it('a page with no price makes a Draft priced 0, its origin, its done job row and its activity row', async () => {
    // Arrange
    const images = ['https://img.example.test/a.jpg'];
    const world = new FakeLinkWorld(() => Promise.resolve({ title: 'Synthetic scarf', imageUrls: images }));

    // Act
    const view = await world.service().importLink(ctx, SCOPE, actor, { url: LINK });

    // Assert
    expect(view).toEqual({ importId: IMPORT_ID, status: 'done', sourceUrl: LINK, productId: PRODUCT_ID });
    expect(world.units).toBe(1);
    expect(world.writes).toEqual(['create', 'origin', 'job', 'activity']);
    expect(world.created[0]?.product).toMatchObject({ title: 'Synthetic scarf', status: 'draft', price: 0 });
    expect(world.origins).toEqual([{ productId: PRODUCT_ID, importJobId: IMPORT_ID, imageUrls: images }]);
    expect(world.jobs[0]).toMatchObject({
      id: IMPORT_ID,
      sourceUrl: LINK,
      productId: PRODUCT_ID,
      actorAdministratorId: 5,
    });
    expect(world.activities).toEqual([
      { scope: SCOPE, importId: IMPORT_ID, productId: PRODUCT_ID, imageCount: 1, actor },
    ]);
  });
});
