import { linkImportInputSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { LinkImportService, type LinkImportView } from '../application/link-import.service';
import { PolishProductService, type PolishedProductView } from '../application/polish-product.service';
import { asOperationContext } from '../application/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { ImportRequestActors } from './actor-of';
import { ImportThrottle } from './import-throttle';
import { parseImportInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** A link import as both API surfaces answer it (`CatalogLinkImport`). */
export type CatalogLinkImportDto = LinkImportView;
/** A product's polished text (`CatalogProductPolish`). */
export type CatalogProductPolishDto = PolishedProductView;

/** The id of a path or argument (Vendure decodes an `ID` to a number or a string); anything else names nothing. */
const idOf = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

/**
 * The link import and polish paths of both API surfaces (D2206, D2214, D2215): a fetch or an AI call spends the
 * caller's scrape budget before anything is parsed (D2217); the tenant comes from the request, never from the path or
 * channel (D2236).
 */
@Injectable()
export class LinkImportActions {
  constructor(
    private readonly links: LinkImportService,
    private readonly polishing: PolishProductService,
    private readonly actors: ImportRequestActors,
    private readonly throttle: ImportThrottle,
  ) {}

  /** Imports the product the input's link names as a Draft. */
  async importLink(ctx: RequestContext, input: unknown): Promise<CatalogLinkImportDto> {
    const scope = await this.spend(ctx);
    const command = parseImportInput(linkImportInputSchema, input);
    const actor = await this.actors.actorOf(ctx);
    return this.links.importLink(asOperationContext(ctx), scope, actor, command);
  }

  /** The link import `id` of the caller's store; anything else is `catalog-import.job-not-found`. */
  status(ctx: RequestContext, id: unknown): Promise<CatalogLinkImportDto> {
    return this.links.status(asOperationContext(ctx), scopeOf(ctx), idOf(id));
  }

  /** The polished text of the caller's product `id`; nothing is saved. */
  async polish(ctx: RequestContext, id: unknown): Promise<CatalogProductPolishDto> {
    const scope = await this.spend(ctx);
    return this.polishing.polish(asOperationContext(ctx), scope, idOf(id));
  }

  private async spend(ctx: RequestContext): Promise<StoreScope> {
    const scope = scopeOf(ctx);
    await this.throttle.spendScrape(scope.businessId, String(ctx.activeUserId));
    return scope;
  }
}
